// ONEWMS set_orders 4가지 호출 방식 동시 검증
// 결과: 어느 방식이 실제로 ONEWMS 에 등록되는지 (또는 모두 같은 응답인지) 확인

import { readFileSync } from 'fs';

// .env.local 파싱
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

console.log('=== ONEWMS 설정 확인 ===');
console.log('API_URL:', API_URL);
console.log('PARTNER_KEY:', PARTNER_KEY ? `set (length=${PARTNER_KEY.length})` : 'MISSING');
console.log('DOMAIN_KEY:', DOMAIN_KEY ? `set (length=${DOMAIN_KEY.length})` : 'MISSING');
console.log('SHOP_ID:', SHOP_ID);
console.log('');

if (!PARTNER_KEY || !DOMAIN_KEY || !SHOP_ID) {
  console.error('❌ 환경변수 누락');
  process.exit(1);
}

// 유니크 주문번호 (타임스탬프 기반, 4가지 방식 각각 다른 ID)
const ts = Date.now().toString(36).toUpperCase();
const baseRow = {
  shop_product_id: 'TEST_PROBE_001',  // 존재하지 않는 코드 → 등록 실패 시 'product not found' 등 메시지로 어느 방식이 실제 파싱됐는지 확인 가능
  qty: 1,
  recv_name: 'API 검증',
  recv_mobile: '01000000000',
  recv_address: '검증용 주소',
  product_name: 'API 검증용 더미상품',
};

const collectDate = new Date().toISOString().slice(2, 10); // YY-MM-DD

// ─────────── 방식 A: form-urlencoded + data 키 ───────────
async function callA() {
  const orderId = `VERIFY-A-${ts}`;
  const formData = new URLSearchParams();
  formData.append('partner_key', PARTNER_KEY);
  formData.append('domain_key', DOMAIN_KEY);
  formData.append('action', 'set_orders');
  formData.append('shop_id', SHOP_ID);
  formData.append('collect_date', collectDate);
  formData.append('data', JSON.stringify([{ ...baseRow, order_id: orderId }]));

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const text = await res.text();
  return { method: 'A (form data=...)', orderId, status: res.status, response: text.slice(0, 400) };
}

// ─────────── 방식 B: form-urlencoded + orders 키 ───────────
async function callB() {
  const orderId = `VERIFY-B-${ts}`;
  const formData = new URLSearchParams();
  formData.append('partner_key', PARTNER_KEY);
  formData.append('domain_key', DOMAIN_KEY);
  formData.append('action', 'set_orders');
  formData.append('shop_id', SHOP_ID);
  formData.append('collect_date', collectDate);
  formData.append('orders', JSON.stringify([{ ...baseRow, order_id: orderId }]));

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const text = await res.text();
  return { method: 'B (form orders=...)', orderId, status: res.status, response: text.slice(0, 400) };
}

// ─────────── 방식 C: application/json + URL query + raw JSON 배열 body ───────────
async function callC() {
  const orderId = `VERIFY-C-${ts}`;
  const qs = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'set_orders',
    shop_id: SHOP_ID,
    collect_date: collectDate,
  });
  const url = `${API_URL}?${qs.toString()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ ...baseRow, order_id: orderId }]),
  });
  const text = await res.text();
  return { method: 'C (application/json + URL query + raw array body)', orderId, status: res.status, response: text.slice(0, 400) };
}

// ─────────── 방식 D: application/json + body 안에 모든 것 ({partner_key, domain_key, action, shop_id, collect_date, data: [...]}) ───────────
async function callD() {
  const orderId = `VERIFY-D-${ts}`;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner_key: PARTNER_KEY,
      domain_key: DOMAIN_KEY,
      action: 'set_orders',
      shop_id: SHOP_ID,
      collect_date: collectDate,
      data: [{ ...baseRow, order_id: orderId }],
    }),
  });
  const text = await res.text();
  return { method: 'D (application/json + body 안 통합)', orderId, status: res.status, response: text.slice(0, 400) };
}

// ─────────── 검증 후 get_order_info 로 조회 ───────────
async function queryOrder(orderId) {
  const formData = new URLSearchParams();
  formData.append('partner_key', PARTNER_KEY);
  formData.append('domain_key', DOMAIN_KEY);
  formData.append('action', 'get_order_info');
  formData.append('date_type', 'collect_date');
  const start = new Date(); start.setDate(start.getDate() - 1);
  const end = new Date(); end.setDate(end.getDate() + 1);
  formData.append('start_date', start.toISOString().slice(0, 10));
  formData.append('end_date', end.toISOString().slice(0, 10));
  formData.append('order_id', orderId);
  formData.append('shop_id', SHOP_ID);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 300) }; }
  return { orderId, total: parsed.total, error: parsed.error, msg: parsed.msg, dataLen: Array.isArray(parsed.data) ? parsed.data.length : 'N/A' };
}

// ─────────── main ───────────
(async () => {
  console.log('=== Step 1: 4가지 방식으로 set_orders 호출 ===\n');
  const results = await Promise.all([callA(), callB(), callC(), callD()]);
  for (const r of results) {
    console.log(`▶ 방식 ${r.method}`);
    console.log(`  order_id: ${r.orderId}`);
    console.log(`  HTTP: ${r.status}`);
    console.log(`  응답: ${r.response}`);
    console.log('');
  }

  console.log('=== Step 2: 5초 대기 후 get_order_info 로 조회 ===\n');
  await new Promise((r) => setTimeout(r, 5000));

  for (const r of results) {
    const q = await queryOrder(r.orderId);
    console.log(`▶ ${r.method}`);
    console.log(`  조회 결과: error=${q.error} msg="${q.msg}" total=${q.total} data.length=${q.dataLen}`);
    console.log('');
  }

  console.log('=== 결론 ===');
  console.log('각 방식의 set_orders 응답에서 error=0 이고, get_order_info 에서 total>=1 인 방식이 실제 작동.');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
