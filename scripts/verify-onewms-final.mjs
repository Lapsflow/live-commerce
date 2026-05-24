// v5 최종 — sub_domain_seq=62 로 우리 VERIFY-* 조회 확인
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const PARTNER_KEY = env.ONEWMS_PARTNER_KEY;
const DOMAIN_KEY = env.ONEWMS_DOMAIN_KEY;
const SHOP_ID = env.ONEWMS_SHOP_ID;
const API_URL = env.ONEWMS_API_URL || 'https://api.onewms.co.kr/api.php';
const CORRECT_SUB_DOMAIN = '62';

console.log(`\n=== 최종 검증: sub_domain_seq=${CORRECT_SUB_DOMAIN} (한국무진유통) 로 우리 발주 조회 ===\n`);

async function fetchTimeout(url, opts, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await (await fetch(url, { ...opts, signal: ctrl.signal })).text(); }
  catch (e) { return `ERROR: ${e.message}`; }
  finally { clearTimeout(t); }
}

// 1) 새 발주 1건 등록 (확정용)
const ts = Date.now().toString(36).toUpperCase();
const newOrderId = `VERIFY-FINAL-${ts}`;
const collectDate = new Date().toISOString().slice(2, 10);

console.log('Step 1: 새 발주 1건 등록');
const qs = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'set_orders',
  shop_id: SHOP_ID, collect_date: collectDate,
});
const r1 = await fetchTimeout(`${API_URL}?${qs.toString()}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{
    order_id: newOrderId,
    shop_product_id: 'TEST_FINAL',
    qty: 1,
    recv_name: '최종검증',
    recv_mobile: '01099990000',
    recv_address: '서울 검증로 최종',
    product_name: '최종 더미',
  }]),
});
console.log(`▶ ${r1}\n`);

// 5초 대기
await new Promise(r => setTimeout(r, 5000));

// 2) sub_domain_seq=62 로 조회
console.log('Step 2: sub_domain_seq=62 로 조회');
const start = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10);
const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const queries = [
  { label: '조회 1: shop_id=10063 + sub_domain_seq=62', extra: { shop_id: SHOP_ID, sub_domain_seq: CORRECT_SUB_DOMAIN } },
  { label: '조회 2: sub_domain_seq=62 만 (shop_id 없음)', extra: { sub_domain_seq: CORRECT_SUB_DOMAIN } },
  { label: '조회 3: order_id 직접 + sub_domain_seq=62', extra: { order_id: newOrderId, sub_domain_seq: CORRECT_SUB_DOMAIN } },
];

for (const q of queries) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'get_order_info',
    date_type: 'collect_date', start_date: start, end_date: end, limit: '100',
    ...q.extra,
  });
  const r = await fetchTimeout(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  let p;
  try { p = JSON.parse(r); } catch { p = { raw: r.slice(0, 200) }; }
  const matches = Array.isArray(p.data) ? p.data.filter(d => String(d.order_id || '').startsWith('VERIFY-')) : [];
  console.log(`▶ ${q.label}`);
  console.log(`  error=${p.error} msg="${p.msg}" total=${p.total} data.len=${Array.isArray(p.data) ? p.data.length : 'N/A'}`);
  console.log(`  VERIFY-* 매칭: ${matches.length}건  sample: ${matches.slice(0, 5).map(d => d.order_id).join(', ')}\n`);
}

console.log('=== 결론 ===');
console.log('VERIFY-* 매칭 > 0 인 조합 = 우리 코드 수정 방향 확정\n');
