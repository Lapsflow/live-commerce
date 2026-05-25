// 종합 — Neon DB 직접 조회 + ONEWMS API + 자동 결론
// Prisma 우회. @neondatabase/serverless 사용 (이미 설치됨)

import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const sql = neon(env.DATABASE_URL);
const PARTNER_KEY = env.ONEWMS_PARTNER_KEY;
const DOMAIN_KEY = env.ONEWMS_DOMAIN_KEY;
const SHOP_ID = env.ONEWMS_SHOP_ID;
const SUB_DOMAIN_SEQ = env.ONEWMS_SUB_DOMAIN_SEQ || '62';
const API_URL = env.ONEWMS_API_URL;

async function callApi(action, params) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action, ...params,
  });
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  const text = await r.text();
  try { return { ok: true, parsed: JSON.parse(text), raw: text }; }
  catch { return { ok: false, parsed: null, raw: text }; }
}

console.log('\n══════════════════════════════════════════════');
console.log('  Product code="827" 종합 진단');
console.log('══════════════════════════════════════════════\n');

// ─── (1) DB 에서 827 검색 ───
console.log('▶ Step 1: DB 에서 다양한 필드로 "827" 검색\n');
const products = await sql`
  SELECT id, code, name, barcode, "onewmsCode", "productType",
         "totalStock", "reservedStock", "isActive", "updatedAt"
  FROM "Product"
  WHERE code = '827' OR barcode = '827' OR "onewmsCode" = '827'
  ORDER BY "updatedAt" DESC
  LIMIT 10
`;
if (products.length === 0) {
  console.log('  ❌ code/barcode/onewmsCode 어느 필드에도 "827" 없음');
  // 좀 더 넓게 — LIKE 검색
  const fuzzy = await sql`
    SELECT id, code, name, barcode, "onewmsCode", "totalStock"
    FROM "Product"
    WHERE code LIKE '%827%' OR name LIKE '%827%' OR barcode LIKE '%827%'
    LIMIT 5
  `;
  if (fuzzy.length > 0) {
    console.log(`  💡 부분 매칭 ${fuzzy.length}건:`);
    for (const p of fuzzy) console.log(`     code=${p.code}  name=${p.name}  barcode=${p.barcode}  onewmsCode=${p.onewmsCode}  totalStock=${p.totalStock}`);
  }
  process.exit(0);
}

for (const p of products) {
  console.log(`  ✅ id=${p.id}`);
  console.log(`     code="${p.code}"  name="${p.name}"`);
  console.log(`     barcode="${p.barcode}"  onewmsCode="${p.onewmsCode}"`);
  console.log(`     productType=${p.productType}  totalStock=${p.totalStock}  reservedStock=${p.reservedStock}  isActive=${p.isActive}`);
  console.log(`     updatedAt=${new Date(p.updatedAt).toISOString()}`);
  console.log('');
}

const target = products[0];

// ─── (2) ONEWMS get_stock_info — onewmsCode 로 ───
if (target.onewmsCode) {
  console.log(`▶ Step 2: ONEWMS get_stock_info (onewmsCode="${target.onewmsCode}")\n`);
  const r = await callApi('get_stock_info', { type: 'product_id', ids: target.onewmsCode });
  console.log(`  raw: ${r.raw.slice(0, 500)}\n`);

  if (r.ok && r.parsed?.data?.[target.onewmsCode]) {
    const entry = r.parsed.data[target.onewmsCode];
    if (entry.stock) {
      const warehouses = Object.entries(entry.stock);
      const total = warehouses.reduce((s, [, w]) => s + (Number(w.stock) || 0), 0);
      console.log(`  ✦ warehouse 응답:`);
      for (const [k, v] of warehouses) {
        console.log(`    warehouse_seq=${k}  stock=${v.stock}`);
      }
      console.log(`  ✦ 합산 = ${total}  vs  우리 totalStock = ${target.totalStock}`);
      if (total !== target.totalStock) {
        console.log(`  🚨 불일치! 우리 코드가 ONEWMS=${total} 인데 DB 는 ${target.totalStock} 으로 stale.`);
      } else {
        console.log(`  ⚠️ 일치하지만 셀러는 1개 봤음 → WMS UI 와 API 응답이 다를 수도. 또는 우리 코드는 정상이나 ONEWMS 측 시점 차이.`);
      }
    }
  }
} else {
  console.log(`  ⚠️ onewmsCode 가 NULL — sync 불가능. 매핑 필요.`);
}

// ─── (3) 최근 sync 이력 ───
console.log('\n▶ Step 3: OnewmsStockSync 최근 5건\n');
const syncs = await sql`
  SELECT "syncedAt", "availableQty", "localQty", "difference", "syncStatus"
  FROM "OnewmsStockSync"
  WHERE "productId" = ${target.id}
  ORDER BY "syncedAt" DESC
  LIMIT 5
`;
if (syncs.length === 0) {
  console.log(`  🚨 이 product 의 sync 이력 0건 — cron 이 이 상품을 처리하지 않고 있음!`);
} else {
  for (const s of syncs) {
    console.log(`  ${new Date(s.syncedAt).toISOString()}  ONEWMS=${s.availableQty}  Local=${s.localQty}  diff=${s.difference}  status=${s.syncStatus}`);
  }
}

// ─── (4) 전체 cron 작동 확인 ───
console.log('\n▶ Step 4: 지난 1시간 전체 sync 통계\n');
const totalSyncs = await sql`
  SELECT COUNT(*)::int as cnt
  FROM "OnewmsStockSync"
  WHERE "syncedAt" >= NOW() - INTERVAL '1 hour'
`;
const lastSync = await sql`SELECT MAX("syncedAt") as last FROM "OnewmsStockSync"`;
const totalProducts = await sql`SELECT COUNT(*)::int as cnt FROM "Product" WHERE "productType" = 'HEADQUARTERS' AND "isActive" = true AND "onewmsCode" IS NOT NULL`;

console.log(`  지난 1시간 sync 기록: ${totalSyncs[0].cnt}건`);
console.log(`  가장 최근 sync: ${lastSync[0].last ? new Date(lastSync[0].last).toISOString() : '없음'}`);
console.log(`  활성 HEADQUARTERS 상품 (sync 대상): ${totalProducts[0].cnt}개`);
console.log(`  1분 cron 이라면 시간당 약 ${totalProducts[0].cnt * 60}건 기록 예상 (배치별 차이 있음)`);

const sinceLastMin = lastSync[0].last ? (Date.now() - new Date(lastSync[0].last).getTime()) / 60000 : null;
if (sinceLastMin !== null) {
  console.log(`  마지막 sync 로부터 ${sinceLastMin.toFixed(1)}분 경과`);
  if (sinceLastMin > 5) console.log(`  🚨 5분 넘게 sync 없음 — cron 멈춤 의심!`);
  else if (sinceLastMin > 2) console.log(`  ⚠️ 2분 넘게 sync 없음 — cron 지연`);
  else console.log(`  ✅ cron 정상 작동 중`);
}

// ─── (5) 최근 OrderItem 으로 827 발주 추적 ───
console.log('\n▶ Step 5: 최근 7일 이 상품의 발주 추적\n');
const orderItems = await sql`
  SELECT o."orderNo", o.status, o."paymentStatus", o."shippingStatus",
         oi.quantity, o."createdAt", o."paidAt"
  FROM "OrderItem" oi
  JOIN "Order" o ON oi."orderId" = o.id
  WHERE oi."productId" = ${target.id}
    AND o."createdAt" >= NOW() - INTERVAL '7 days'
  ORDER BY o."createdAt" DESC
  LIMIT 10
`;
if (orderItems.length === 0) {
  console.log(`  최근 7일 이 상품의 발주 0건`);
} else {
  for (const o of orderItems) {
    console.log(`  ${o.orderNo}  ${o.status}/${o.paymentStatus}/${o.shippingStatus}  qty=${o.quantity}  생성=${new Date(o.createdAt).toISOString()}`);
  }
}

console.log('\n══════════════════════════════════════════════');
console.log('  자동 결론');
console.log('══════════════════════════════════════════════\n');
console.log(`우리 DB totalStock: ${target.totalStock}`);
console.log(`셀러가 본 WMS UI: 1`);
console.log(`onewmsCode: ${target.onewmsCode || '(NULL!)'}`);

console.log('\n끝.\n');
