// 종합 진단 — code 827 상품의 재고 불일치 원인 추적
// 5개 영역 동시 분석: (1) ONEWMS 실응답 raw dump (2) warehouse 목록 (3) 우리 DB 상태 (4) sync 이력 (5) 자동 결론

import { readFileSync, writeFileSync } from 'fs';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const PARTNER_KEY = env.ONEWMS_PARTNER_KEY;
const DOMAIN_KEY = env.ONEWMS_DOMAIN_KEY;
const SHOP_ID = env.ONEWMS_SHOP_ID;
const SUB_DOMAIN_SEQ = env.ONEWMS_SUB_DOMAIN_SEQ || '62';
const API_URL = env.ONEWMS_API_URL || 'https://api.onewms.co.kr/api.php';
process.env.DATABASE_URL = env.DATABASE_URL;

const prisma = new PrismaClient();

async function fetchT(url, opts, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await (await fetch(url, { ...opts, signal: c.signal })).text(); }
  catch (e) { return `ERROR: ${e.message}`; }
  finally { clearTimeout(t); }
}

async function callApi(action, params) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action,
    ...params,
  });
  const r = await fetchT(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  try { return { ok: true, parsed: JSON.parse(r), raw: r }; }
  catch { return { ok: false, parsed: null, raw: r }; }
}

console.log('\n══════════════════════════════════════════════');
console.log('  827번 상품 재고 불일치 종합 진단');
console.log('══════════════════════════════════════════════\n');

// ─── (1) 우리 DB 의 product 827 정보 ───
console.log('▶ Step 1: 우리 DB 의 product code="827" 조회\n');
const ourProduct = await prisma.product.findFirst({
  where: { code: '827' },
  select: {
    id: true, code: true, name: true, barcode: true, onewmsCode: true,
    productType: true, totalStock: true, isActive: true, updatedAt: true,
  },
});
if (!ourProduct) {
  console.log('  ❌ product code="827" 가 DB 에 없음. 다른 식별자로 검색 필요.');
  // barcode 또는 onewmsCode 가 827 일 수도
  const altByOnewms = await prisma.product.findFirst({ where: { onewmsCode: '827' }, select: { id: true, code: true, name: true, onewmsCode: true, totalStock: true } });
  if (altByOnewms) console.log(`  💡 onewmsCode="827" 로 매칭: ${JSON.stringify(altByOnewms)}`);
  const altByBarcode = await prisma.product.findFirst({ where: { barcode: '827' }, select: { id: true, code: true, name: true, barcode: true, totalStock: true } });
  if (altByBarcode) console.log(`  💡 barcode="827" 로 매칭: ${JSON.stringify(altByBarcode)}`);
  if (!altByOnewms && !altByBarcode) {
    console.log('  ❌ code/onewmsCode/barcode 어느 것도 매칭 안 됨. 셀러에게 정확한 식별자 재확인 필요.');
    await prisma.$disconnect();
    process.exit(0);
  }
} else {
  console.log(`  ✅ 발견:`);
  console.log(`     id=${ourProduct.id}`);
  console.log(`     code=${ourProduct.code}  name="${ourProduct.name}"`);
  console.log(`     barcode=${ourProduct.barcode}  onewmsCode=${ourProduct.onewmsCode}`);
  console.log(`     productType=${ourProduct.productType}  totalStock=${ourProduct.totalStock}  isActive=${ourProduct.isActive}`);
  console.log(`     updatedAt=${ourProduct.updatedAt.toISOString()}`);
}

const targetOnewmsCode = ourProduct?.onewmsCode;
if (!targetOnewmsCode) {
  console.log('\n  ⚠️ onewmsCode 가 없으면 ONEWMS API 조회 불가. 매핑 필요.');
  await prisma.$disconnect();
  process.exit(0);
}

// ─── (2) ONEWMS get_stock_info 호출 — 다양한 옵션 비교 ───
console.log('\n▶ Step 2: ONEWMS get_stock_info 다양한 옵션 비교\n');

// 2-1. 기본 호출 (warehouse_seq 미지정)
const r1 = await callApi('get_stock_info', { type: 'product_id', ids: targetOnewmsCode });
console.log(`  2-1. 기본 호출 (warehouse_seq 미지정):`);
console.log(`       raw 응답: ${r1.raw.slice(0, 600)}`);
console.log('');

// 응답 구조 분석
if (r1.ok && r1.parsed.data) {
  const stockEntry = r1.parsed.data[targetOnewmsCode];
  if (stockEntry?.stock) {
    console.log(`  🔬 응답에 포함된 warehouse 목록:`);
    for (const [whSeq, wh] of Object.entries(stockEntry.stock)) {
      console.log(`       warehouse_seq=${whSeq}  stock=${wh.stock}`);
    }
    const sum = Object.values(stockEntry.stock).reduce((s, w) => s + (Number(w.stock) || 0), 0);
    console.log(`  💡 모든 warehouse 합산 = ${sum} (현재 우리 코드의 계산 방식)`);
  } else {
    console.log(`  ⚠️ stock 필드 없음: ${JSON.stringify(r1.parsed.data).slice(0, 300)}`);
  }
}
console.log('');

// 2-2. warehouse_seq=1 명시
const r2 = await callApi('get_stock_info', { type: 'product_id', ids: targetOnewmsCode, warehouse_seq: '1' });
console.log(`  2-2. warehouse_seq=1 명시:  raw: ${r2.raw.slice(0, 400)}\n`);

// 2-3. sub_domain_seq=62 추가
const r3 = await callApi('get_stock_info', { type: 'product_id', ids: targetOnewmsCode, sub_domain_seq: SUB_DOMAIN_SEQ });
console.log(`  2-3. sub_domain_seq=${SUB_DOMAIN_SEQ} 추가:  raw: ${r3.raw.slice(0, 400)}\n`);

// 2-4. include_ready_trans=1 (접수/송장 포함)
const r4 = await callApi('get_stock_info', { type: 'product_id', ids: targetOnewmsCode, include_ready_trans: '1' });
console.log(`  2-4. include_ready_trans=1 (접수/송장 포함):  raw: ${r4.raw.slice(0, 400)}\n`);

// ─── (3) ONEWMS 의 한국무진유통 창고 목록 ───
console.log('▶ Step 3: 한국무진유통이 사용하는 warehouse 목록\n');
const whRes = await callApi('get_etc_info', { search_type: 'warehouse' });
if (whRes.ok && whRes.parsed.data) {
  console.log(`  전체 warehouse 응답(앞 800자): ${JSON.stringify(whRes.parsed.data).slice(0, 800)}`);
} else {
  console.log(`  ⚠️ ${whRes.raw.slice(0, 400)}`);
}
console.log('');

// ─── (4) 우리 DB 의 OnewmsStockSync 최근 이력 ───
console.log('▶ Step 4: 우리 DB 의 OnewmsStockSync 최근 5건 이력\n');
const syncs = await prisma.onewmsStockSync.findMany({
  where: { productId: ourProduct.id },
  orderBy: { syncedAt: 'desc' },
  take: 5,
  select: { syncedAt: true, availableQty: true, localQty: true, difference: true, syncStatus: true },
});
if (syncs.length === 0) {
  console.log(`  ⚠️ 이 product 에 대한 sync 이력 0건. 1분 cron 이 이 상품을 처리하지 않고 있음.`);
} else {
  for (const s of syncs) {
    console.log(`  - ${s.syncedAt.toISOString()}  ONEWMS=${s.availableQty}  Local=${s.localQty}  diff=${s.difference}  status=${s.syncStatus}`);
  }
}
console.log('');

// ─── (5) 전체 cron sync 상태 — 마지막 1시간 ───
console.log('▶ Step 5: 전체 sync cron 작동 여부 (지난 1시간)\n');
const cutoff = new Date(Date.now() - 60 * 60 * 1000);
const totalSync = await prisma.onewmsStockSync.count({ where: { syncedAt: { gte: cutoff } } });
const oldestRecent = await prisma.onewmsStockSync.findFirst({
  where: { syncedAt: { gte: cutoff } },
  orderBy: { syncedAt: 'asc' },
  select: { syncedAt: true },
});
const newestRecent = await prisma.onewmsStockSync.findFirst({
  orderBy: { syncedAt: 'desc' },
  select: { syncedAt: true },
});
console.log(`  지난 1시간 sync 기록: ${totalSync}건`);
if (oldestRecent) console.log(`  가장 오래된: ${oldestRecent.syncedAt.toISOString()}`);
if (newestRecent) console.log(`  가장 최근: ${newestRecent.syncedAt.toISOString()}`);
if (totalSync === 0) {
  console.log(`  🚨 지난 1시간 sync 0건 — 1분 cron 멈춤 의심!`);
} else if (totalSync < 60) {
  console.log(`  ⚠️ 1분 cron 이라면 시간당 60×활성상품수 건 예상. 실제 ${totalSync} 건 — 부분 실패 의심`);
}

// ─── (6) 자동 결론 ───
console.log('\n══════════════════════════════════════════════');
console.log('  자동 진단 결론');
console.log('══════════════════════════════════════════════\n');

if (r1.ok && r1.parsed.data?.[targetOnewmsCode]?.stock) {
  const warehouses = Object.entries(r1.parsed.data[targetOnewmsCode].stock);
  const total = warehouses.reduce((s, [, w]) => s + (Number(w.stock) || 0), 0);
  console.log(`ONEWMS 응답의 warehouse 개수: ${warehouses.length}`);
  console.log(`각 warehouse 재고: ${warehouses.map(([k, v]) => `wh${k}=${v.stock}`).join(', ')}`);
  console.log(`현재 코드의 합산 결과: ${total}`);
  console.log(`우리 DB totalStock: ${ourProduct.totalStock}`);

  if (warehouses.length > 1 && total !== ourProduct.totalStock) {
    console.log('\n🎯 의심 A 확정: 여러 warehouse 합산이 잘못된 결과를 만들고 있음.');
    console.log('   해결: stockSync 에서 warehouse_seq=1 (또는 한국무진유통 전용 창고) 만 사용하도록 수정.');
  } else if (total === ourProduct.totalStock) {
    console.log('\n🎯 ONEWMS API 응답과 우리 DB 일치 — 셀러가 본 WMS UI 화면과 API 응답이 다를 수도 있음.');
    console.log('   해결: 한국무진 측에 ONEWMS UI 의 "1개" 가 어느 warehouse_seq 인지 확인 요청.');
  }
} else {
  console.log('⚠️ ONEWMS API 응답 파싱 실패 또는 stock 데이터 없음. raw 응답 직접 확인 필요.');
}

await prisma.$disconnect();
console.log('\n끝.\n');
