// v6 최종 — 실제 ONEWMS 에 등록된 shop_product_id 로 set_orders → get_order_info 검증
// 가설: 존재하지 않는 product_id 면 silent ignore. 정상 product_id 면 실제 등록됨.

import { readFileSync, writeFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const PARTNER_KEY = env.ONEWMS_PARTNER_KEY;
const DOMAIN_KEY = env.ONEWMS_DOMAIN_KEY;
const SHOP_ID = env.ONEWMS_SHOP_ID;
const API_URL = env.ONEWMS_API_URL || 'https://api.onewms.co.kr/api.php';

async function fetchT(url, opts, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await (await fetch(url, { ...opts, signal: c.signal })).text(); }
  catch (e) { return `ERROR: ${e.message}`; }
  finally { clearTimeout(t); }
}

// ─── Step 1: 한국무진유통 영역 (sub_domain_seq=62) 의 기존 주문 1건 가져오기 ───
console.log('\n=== Step 1: 한국무진유통 영역의 정상 주문에서 shop_product_id 추출 ===\n');
const start = new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10);
const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const fd = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'get_order_info',
  date_type: 'collect_date', start_date: start, end_date: end, limit: '10',
  shop_id: SHOP_ID, sub_domain_seq: '62',
});
const r1 = await fetchT(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: fd.toString(),
});
writeFileSync('/tmp/onewms-our-orders.json', r1);

let realProductId = null;
let sampleOrder = null;
try {
  const p = JSON.parse(r1);
  if (Array.isArray(p.data) && p.data.length > 0) {
    sampleOrder = p.data[0];
    realProductId = sampleOrder.shop_product_id || sampleOrder.product_id;
    console.log(`✅ 한국무진유통 영역 주문 ${p.data.length}건 확인. 첫 번째 주문 샘플:`);
    console.log(`  order_id: ${sampleOrder.order_id}`);
    console.log(`  shop_product_id: ${sampleOrder.shop_product_id}`);
    console.log(`  product_id: ${sampleOrder.product_id}`);
    console.log(`  product_name: ${sampleOrder.product_name}`);
    console.log(`  recv_name: ${sampleOrder.recv_name}`);
    console.log(`  status: ${sampleOrder.status}`);
    console.log(`  → 정상 shop_product_id="${realProductId}" 사용해서 테스트 발주 등록 시도\n`);
  } else {
    console.log(`❌ 한국무진유통 영역 주문 없음. error=${p.error} msg="${p.msg}"`);
    process.exit(1);
  }
} catch (e) {
  console.log(`❌ 응답 파싱 실패: ${e.message}`);
  console.log(`응답 앞 500자: ${r1.slice(0, 500)}`);
  process.exit(1);
}

// ─── Step 2: 정상 product_id 로 set_orders ───
console.log('=== Step 2: 정상 shop_product_id 로 set_orders ===');
const ts = Date.now().toString(36).toUpperCase();
const newOrderId = `VERIFY-REAL-${ts}`;
const collectDate = new Date().toISOString().slice(2, 10);

const qs = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'set_orders',
  shop_id: SHOP_ID, collect_date: collectDate,
});
const r2 = await fetchT(`${API_URL}?${qs.toString()}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{
    order_id: newOrderId,
    shop_product_id: realProductId,   // ★ 정상 product_id
    qty: 1,
    recv_name: '검증REAL',
    recv_mobile: '01000000099',
    recv_address: '서울 검증로 REAL',
    product_name: sampleOrder.product_name || '실상품 테스트',
  }]),
});
console.log(`▶ 응답: ${r2}\n`);

await new Promise(r => setTimeout(r, 5000));

// ─── Step 3: 조회 ───
console.log('=== Step 3: sub_domain_seq=62 로 VERIFY-REAL-* 조회 ===');
const fd3 = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'get_order_info',
  date_type: 'collect_date', start_date: start, end_date: end, limit: '100',
  shop_id: SHOP_ID, sub_domain_seq: '62',
});
const r3 = await fetchT(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: fd3.toString(),
});
try {
  const p = JSON.parse(r3);
  const matches = (p.data || []).filter(d => String(d.order_id || '').startsWith('VERIFY-REAL'));
  console.log(`▶ error=${p.error} msg="${p.msg}" total=${p.total} data.len=${(p.data || []).length}`);
  console.log(`▶ VERIFY-REAL-* 매칭: ${matches.length}건`);
  if (matches.length > 0) {
    console.log('\n🎯 매칭된 주문 상세:');
    for (const m of matches.slice(0, 3)) {
      console.log(`  order_id=${m.order_id}  status=${m.status}  product=${m.product_name}  recv=${m.recv_name}`);
    }
    console.log('\n✅ 결론: 정상 product_id 로 호출하면 ONEWMS 에 진짜 등록됨!');
    console.log('   → #4 원인 = 우리 발주의 일부 product.onewmsCode 가 ONEWMS 미등록 상품');
    console.log('   → 해결 방향: 발주 컨펌 전에 product.onewmsCode 가 ONEWMS 에 존재하는지 사전 검증');
  } else {
    console.log('\n❌ 매칭 0건 — 정상 product_id 로도 등록 안 됨. 다른 원인.');
    console.log(`   첫 5건 sample: ${(p.data || []).slice(0, 5).map(d => d.order_id).join(', ')}`);
  }
} catch (e) {
  console.log(`❌ 조회 응답 파싱 실패: ${e.message}`);
  console.log(`응답 앞 500자: ${r3.slice(0, 500)}`);
}

console.log('');
