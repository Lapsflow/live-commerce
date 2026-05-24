// ONEWMS set_orders 검증 v2 — sub_domain_seq=20 으로 등록건 조회
// v1 에서 방식 C 가 success 로 등록됐음을 확인. 이번엔 sub_domain_seq=20 으로 조회.

import { readFileSync } from 'fs';

const env = {};
const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const PARTNER_KEY = env.ONEWMS_PARTNER_KEY;
const DOMAIN_KEY = env.ONEWMS_DOMAIN_KEY;
const SHOP_ID = env.ONEWMS_SHOP_ID;
const API_URL = env.ONEWMS_API_URL || 'https://api.onewms.co.kr/api.php';

// 새로 1건 더 등록해서 비교
const ts = Date.now().toString(36).toUpperCase();
const newOrderId = `VERIFY-V2-${ts}`;
const collectDate = new Date().toISOString().slice(2, 10);

console.log('=== Step 1: 방식 C 로 새 발주 1건 등록 (sub_domain_seq=20 명시) ===\n');

// 등록 (방식 C 확정)
async function createOrder(includeSubDomain = false) {
  const qs = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'set_orders',
    shop_id: SHOP_ID,
    collect_date: collectDate,
    ...(includeSubDomain && { sub_domain_seq: '20' }),
  });
  const res = await fetch(`${API_URL}?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      order_id: newOrderId,
      shop_product_id: 'TEST_PROBE_002',
      qty: 1,
      recv_name: 'V2 검증',
      recv_mobile: '01000000001',
      recv_address: '서울 검증로 2',
      product_name: 'V2 더미상품',
    }]),
  });
  const text = await res.text();
  return { status: res.status, response: text };
}

const r1 = await createOrder(false);
console.log(`▶ set_orders (sub_domain_seq 없이): HTTP ${r1.status}`);
console.log(`  ${r1.response.slice(0, 300)}\n`);

const r2 = await createOrder(true);
console.log(`▶ set_orders (sub_domain_seq=20 추가): HTTP ${r2.status}`);
console.log(`  ${r2.response.slice(0, 300)}\n`);

await new Promise(r => setTimeout(r, 5000));

// 조회 (sub_domain_seq 4가지 조합으로)
async function queryOrder(label, params) {
  const formData = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'get_order_info',
    date_type: 'collect_date',
    start_date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    limit: '100',
    ...params,
  });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const text = await res.text();
  let p;
  try { p = JSON.parse(text); } catch { p = { raw: text.slice(0, 200) }; }
  // VERIFY-V2-* 또는 VERIFY-C-MPGLLNPU 가 결과에 있는지 검색
  const matches = Array.isArray(p.data) ? p.data.filter(d =>
    String(d.order_id || '').startsWith('VERIFY-')
  ) : [];
  return {
    label,
    error: p.error,
    msg: p.msg,
    total: p.total,
    dataLen: Array.isArray(p.data) ? p.data.length : 'N/A',
    verifyMatches: matches.length,
    sampleIds: matches.slice(0, 5).map(d => d.order_id),
  };
}

console.log('=== Step 2: sub_domain_seq 조합별 get_order_info 시도 ===\n');

const queries = [
  { label: '쿼리 1: shop_id=10063 + sub_domain_seq=20', params: { shop_id: SHOP_ID, sub_domain_seq: '20' } },
  { label: '쿼리 2: shop_id=10063 만 (sub_domain_seq 없음)', params: { shop_id: SHOP_ID } },
  { label: '쿼리 3: sub_domain_seq=20 만 (shop_id 없음)', params: { sub_domain_seq: '20' } },
  { label: '쿼리 4: order_id 직접 지정 + sub_domain_seq=20', params: { order_id: newOrderId, sub_domain_seq: '20' } },
  { label: '쿼리 5: order_id 직접 지정 (sub_domain_seq 없음)', params: { order_id: newOrderId } },
];

for (const q of queries) {
  const r = await queryOrder(q.label, q.params);
  console.log(`▶ ${r.label}`);
  console.log(`  error=${r.error} msg="${r.msg}" total=${r.total} data.len=${r.dataLen}`);
  console.log(`  VERIFY-* 매칭: ${r.verifyMatches}건  sample: ${r.sampleIds.join(', ')}`);
  console.log('');
}

// get_etc_info 로 sub_domain 목록 확인
console.log('=== Step 3: get_etc_info?search_type=sub_domain 로 화주 전체 목록 ===\n');
async function getEtcInfo(searchType) {
  const formData = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'get_etc_info',
    search_type: searchType,
  });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const text = await res.text();
  return text;
}

const subDomainsRaw = await getEtcInfo('sub_domain');
console.log(`▶ search_type=sub_domain 응답:`);
console.log(`  ${subDomainsRaw.slice(0, 800)}\n`);

const shopsRaw = await getEtcInfo('shop');
console.log(`▶ search_type=shop 응답:`);
console.log(`  ${shopsRaw.slice(0, 800)}\n`);

console.log('=== 결론 ===');
console.log('1. 위 5개 쿼리 중 verifyMatches > 0 인 조합 = ONEWMS 가 우리 발주를 보이는 조건');
console.log('2. 그 조합대로 client.ts:getOrderInfo 및 orderSync.ts 의 호출부 정정');
