// DB 없이 ONEWMS API 만으로 827번 재고 구조 진단
// 사용: node scripts/diag-stock-827-light.mjs [onewmsCode]
//   기본값: 827 (사용자가 말한 번호 그대로 시도)

import { readFileSync } from 'fs';

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

const TARGET = process.argv[2] || '827';

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

console.log(`\n══════════════════════════════════════════════`);
console.log(`  827번 재고 구조 진단 (TARGET=${TARGET})`);
console.log(`══════════════════════════════════════════════\n`);

// ─── Step 1: get_stock_info — 다양한 type 으로 시도 ───
console.log(`▶ Step 1: get_stock_info — ${TARGET} 를 다양한 type 으로 조회\n`);

for (const type of ['product_id', 'barcode', 'supply_code', 'link_id']) {
  console.log(`  ─ type=${type} ─`);
  const r = await callApi('get_stock_info', { type, ids: TARGET });
  console.log(`  raw 응답: ${r.raw.slice(0, 400)}`);

  if (r.ok && r.parsed?.data) {
    const entry = r.parsed.data[TARGET];
    if (entry?.stock) {
      const warehouses = Object.entries(entry.stock);
      const total = warehouses.reduce((s, [, w]) => s + (Number(w.stock) || 0), 0);
      console.log(`  ✅ 매칭!`);
      console.log(`     product_id=${entry.product_id} link_id=${entry.link_id} barcode=${entry.barcode}`);
      console.log(`     warehouse 개수: ${warehouses.length}`);
      for (const [whSeq, wh] of warehouses) {
        console.log(`       warehouse_seq=${whSeq}  stock=${wh.stock}`);
      }
      console.log(`     ✦ 모든 warehouse 합산 = ${total}`);
      console.log(`     ✦ warehouse_seq=1 만의 stock = ${entry.stock['1']?.stock ?? '없음'}`);
      console.log(`     ✦ 셀러가 본 WMS UI 의 "1개" 와 비교 → 어느 warehouse_seq 인지 즉시 식별 가능\n`);
    }
  }
  console.log('');
}

// ─── Step 2: warehouse_seq=1 명시해서 다시 호출 ───
console.log(`▶ Step 2: warehouse_seq=1 명시 호출 (ONEWMS 공식 기본값)\n`);
const r2 = await callApi('get_stock_info', { type: 'product_id', ids: TARGET, warehouse_seq: '1' });
console.log(`  raw: ${r2.raw.slice(0, 500)}\n`);

// ─── Step 3: 한국무진유통의 warehouse 목록 ───
console.log(`▶ Step 3: get_etc_info?search_type=warehouse — 한국무진유통이 사용하는 warehouse\n`);
const whRes = await callApi('get_etc_info', { search_type: 'warehouse' });
if (whRes.ok && whRes.parsed?.data) {
  console.log(`  warehouse 전체 응답:`);
  console.log(`  ${JSON.stringify(whRes.parsed.data, null, 2).slice(0, 1500)}`);
} else {
  console.log(`  ⚠️ ${whRes.raw.slice(0, 400)}`);
}

// ─── Step 4: 한국무진유통(sub_domain_seq=62) 의 product 목록에서 827 검색 ───
console.log(`\n▶ Step 4: 한국무진유통 영역 주문에서 ${TARGET} 흔적 검색\n`);
const start = new Date(Date.now() - 86400000 * 14).toISOString().slice(0, 10);
const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const r4 = await callApi('get_order_info', {
  date_type: 'collect_date', start_date: start, end_date: end, limit: '5',
  shop_id: SHOP_ID, sub_domain_seq: SUB_DOMAIN_SEQ, product_id: TARGET,
});
if (r4.ok && r4.parsed?.data) {
  console.log(`  product_id=${TARGET} 로 검색 총 ${r4.parsed.total}건`);
  for (const o of (r4.parsed.data || []).slice(0, 3)) {
    console.log(`    - order_id=${o.order_id} status=${o.status} product_name="${o.product_name}"`);
    if (o.order_products?.[0]) {
      console.log(`      → ONEWMS 내부 product_id=${o.order_products[0].product_id}  supply_code=${o.order_products[0].supply_code}`);
    }
  }
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`  진단 가이드`);
console.log(`══════════════════════════════════════════════\n`);
console.log(`✦ Step 1 에서 어떤 type 으로 ${TARGET} 가 매칭됐는지 확인`);
console.log(`✦ warehouse 응답이 여러 개면 → 우리 코드 합산 버그 (의심 A 확정)`);
console.log(`✦ Step 3 의 warehouse 목록에서 한국무진유통 전용 창고 식별`);
console.log(`✦ 셀러가 본 "1개" 가 어느 warehouse_seq 에 해당하는지 매핑`);
console.log(`\n끝.\n`);
