// product.name 이 [827] 으로 시작하는 상품 검색 + ONEWMS 진단

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
const SUB_DOMAIN_SEQ = env.ONEWMS_SUB_DOMAIN_SEQ || '62';
const API_URL = env.ONEWMS_API_URL;

console.log('\n══════════════════════════════════════════════');
console.log('  [827] prefix 상품 검색 + ONEWMS 진단');
console.log('══════════════════════════════════════════════\n');

// 1. name 이 [827] 로 시작하는 상품
console.log('▶ Step 1: name 이 [827] 로 시작하는 product 검색\n');
const exact = await sql`
  SELECT id, code, name, barcode, "onewmsCode", "productType",
         "totalStock", "reservedStock", "isActive", "updatedAt"
  FROM "Product"
  WHERE name LIKE '[827]%' OR name LIKE '[827] %'
  ORDER BY "updatedAt" DESC
`;
if (exact.length === 0) {
  console.log('  ❌ [827] 정확 시작 없음. 좀 더 넓게 검색...\n');
  const fuzzy = await sql`
    SELECT id, code, name, barcode, "onewmsCode", "totalStock", "isActive"
    FROM "Product"
    WHERE name LIKE '%[827]%' OR name LIKE '%[ 827]%' OR name LIKE '%[827 ]%'
    ORDER BY "updatedAt" DESC
    LIMIT 20
  `;
  if (fuzzy.length > 0) {
    console.log(`  💡 [827] 부분 매칭 ${fuzzy.length}건:`);
    for (const p of fuzzy) console.log(`     code=${p.code}  name="${p.name}"  onewmsCode=${p.onewmsCode}  totalStock=${p.totalStock}  isActive=${p.isActive}`);
  } else {
    console.log('  ❌ 어떤 형태로도 [827] 매칭 없음.');
    // [82], [827, 827] 등 변형 시도
    const variants = await sql`
      SELECT id, code, name, "onewmsCode", "totalStock"
      FROM "Product"
      WHERE name SIMILAR TO '%\\[(826|827|828)\\]%'
      LIMIT 10
    `;
    if (variants.length > 0) {
      console.log(`  💡 인접 번호 [826]/[827]/[828] 검색 결과:`);
      for (const p of variants) console.log(`     ${p.name}  onewmsCode=${p.onewmsCode}  totalStock=${p.totalStock}`);
    }
  }
  process.exit(0);
}

for (const p of exact) {
  console.log(`  ✅ id=${p.id}`);
  console.log(`     code="${p.code}"  name="${p.name}"`);
  console.log(`     barcode="${p.barcode}"  onewmsCode="${p.onewmsCode}"`);
  console.log(`     productType=${p.productType}  totalStock=${p.totalStock}  reservedStock=${p.reservedStock}  isActive=${p.isActive}`);
  console.log(`     updatedAt=${new Date(p.updatedAt).toISOString()}\n`);
}

const target = exact[0];

// 2. ONEWMS get_stock_info
if (target.onewmsCode) {
  console.log(`▶ Step 2: ONEWMS get_stock_info (onewmsCode="${target.onewmsCode}")\n`);
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY,
    action: 'get_stock_info', type: 'product_id', ids: target.onewmsCode,
  });
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  const text = await r.text();
  console.log(`  raw: ${text.slice(0, 600)}\n`);
  try {
    const p = JSON.parse(text);
    const entry = p.data?.[target.onewmsCode];
    if (entry?.stock) {
      const warehouses = Object.entries(entry.stock);
      const total = warehouses.reduce((s, [, w]) => s + (Number(w.stock) || 0), 0);
      console.log(`  ✦ warehouse 응답:`);
      for (const [k, v] of warehouses) console.log(`    warehouse_seq=${k}  stock=${v.stock}`);
      console.log(`  ✦ 합산 = ${total}`);
      console.log(`  ✦ 우리 DB totalStock = ${target.totalStock}`);
      console.log(`  ✦ 셀러가 본 WMS UI = 1`);
      console.log('');
      if (total === 1 && target.totalStock !== 1) {
        console.log(`  🎯 결론 확정: ONEWMS=1 인데 우리 DB는 ${target.totalStock} — sync 누락/지연.`);
      } else if (total !== 1 && target.totalStock !== 1) {
        console.log(`  🎯 결론: ONEWMS API 자체가 ${total} 반환. ONEWMS UI 와 API 가 다른 데이터를 보여줌. → 한국무진 측 확인 필요.`);
      } else if (total === target.totalStock && total !== 1) {
        console.log(`  🎯 결론: 우리 코드는 정상 (ONEWMS API = DB). ONEWMS UI 만 다른 값 표시. → 한국무진 측 UI vs API 불일치.`);
      }
    }
  } catch (e) {
    console.log(`  파싱 실패: ${e.message}`);
  }
} else {
  console.log(`  ⚠️ onewmsCode NULL — sync 자체 불가능.`);
}

// 3. 최근 sync 이력
console.log(`\n▶ Step 3: OnewmsStockSync 최근 5건 (product id=${target.id})\n`);
const syncs = await sql`
  SELECT "syncedAt", "availableQty", "localQty", "difference", "syncStatus"
  FROM "OnewmsStockSync"
  WHERE "productId" = ${target.id}
  ORDER BY "syncedAt" DESC
  LIMIT 5
`;
if (syncs.length === 0) {
  console.log(`  🚨 sync 이력 0건 — cron이 이 상품을 처리하지 않음.`);
  console.log(`     원인 후보: productType=${target.productType} (HEADQUARTERS 만 sync 대상), isActive=${target.isActive}, onewmsCode=${target.onewmsCode}`);
} else {
  for (const s of syncs) {
    console.log(`  ${new Date(s.syncedAt).toISOString()}  ONEWMS=${s.availableQty}  Local=${s.localQty}  diff=${s.difference}  status=${s.syncStatus}`);
  }
}

// 4. 전체 cron 작동
console.log(`\n▶ Step 4: 전체 cron 작동 확인 (지난 1시간)\n`);
const t = await sql`SELECT COUNT(*)::int as cnt FROM "OnewmsStockSync" WHERE "syncedAt" >= NOW() - INTERVAL '1 hour'`;
const l = await sql`SELECT MAX("syncedAt") as last FROM "OnewmsStockSync"`;
console.log(`  지난 1시간 sync: ${t[0].cnt}건`);
console.log(`  마지막 sync: ${l[0].last ? new Date(l[0].last).toISOString() : '없음'}`);
if (l[0].last) {
  const ago = (Date.now() - new Date(l[0].last).getTime()) / 60000;
  console.log(`  ${ago.toFixed(1)}분 경과 ${ago > 5 ? '🚨 cron 멈춤 의심' : ago > 2 ? '⚠️ 지연' : '✅ 정상'}`);
}

// 5. 최근 7일 발주
console.log(`\n▶ Step 5: 최근 7일 이 상품의 발주 추적\n`);
const orders = await sql`
  SELECT o."orderNo", o.status, o."paymentStatus", o."shippingStatus",
         oi.quantity, o."createdAt"
  FROM "OrderItem" oi
  JOIN "Order" o ON oi."orderId" = o.id
  WHERE oi."productId" = ${target.id}
    AND o."createdAt" >= NOW() - INTERVAL '7 days'
  ORDER BY o."createdAt" DESC
  LIMIT 10
`;
if (orders.length === 0) console.log(`  최근 7일 발주 없음`);
else for (const o of orders) console.log(`  ${o.orderNo}  ${o.status}/${o.paymentStatus}/${o.shippingStatus}  qty=${o.quantity}  ${new Date(o.createdAt).toISOString()}`);

console.log('\n끝.\n');
