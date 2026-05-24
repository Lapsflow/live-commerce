// v3 — fetch timeout 8초 + 순차 실행 + 진행 로그
// v2 의 Step 2 가 응답 없는 fetch 에서 hang 되는 문제 해결

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

// fetch wrapper with timeout
async function fetchWithTimeout(url, opts, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: e.name === 'AbortError' ? `TIMEOUT after ${timeoutMs}ms` : `ERROR: ${e.message}` };
  } finally {
    clearTimeout(t);
  }
}

function log(line) { process.stdout.write(line + '\n'); }

const ts = Date.now().toString(36).toUpperCase();
const newOrderId = `VERIFY-V3-${ts}`;
const collectDate = new Date().toISOString().slice(2, 10);

log(`\n=== ONEWMS V3 검증 시작 (newOrderId=${newOrderId}) ===\n`);

// ─── Step 1: 방식 C 로 1건 등록 ───
log('=== Step 1: set_orders 방식 C 등록 ===');
const qs = new URLSearchParams({
  partner_key: PARTNER_KEY,
  domain_key: DOMAIN_KEY,
  action: 'set_orders',
  shop_id: SHOP_ID,
  collect_date: collectDate,
});
const r1 = await fetchWithTimeout(`${API_URL}?${qs.toString()}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{
    order_id: newOrderId,
    shop_product_id: 'TEST_PROBE_003',
    qty: 1,
    recv_name: 'V3 검증',
    recv_mobile: '01000000003',
    recv_address: '서울 검증로 3',
    product_name: 'V3 더미상품',
  }]),
}, 8000);
log(`▶ HTTP ${r1.status}  응답: ${r1.text.slice(0, 200)}\n`);

// ─── Step 2: get_order_info 5가지 조합 (순차 실행 + timeout) ───
log('=== Step 2: get_order_info 5가지 조합 (각 8초 timeout) ===\n');

async function queryOrder(label, extraParams) {
  log(`▶ ${label}`);
  const start = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const formData = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'get_order_info',
    date_type: 'collect_date',
    start_date: start,
    end_date: end,
    limit: '100',
    ...extraParams,
  });
  const r = await fetchWithTimeout(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  }, 8000);
  if (!r.ok) {
    log(`  ❌ ${r.text}\n`);
    return;
  }
  let p;
  try { p = JSON.parse(r.text); } catch { p = { raw: r.text.slice(0, 200) }; }
  const matches = Array.isArray(p.data) ? p.data.filter(d => String(d.order_id || '').startsWith('VERIFY-')) : [];
  log(`  HTTP ${r.status}  error=${p.error}  msg="${p.msg}"  total=${p.total}  data.len=${Array.isArray(p.data) ? p.data.length : 'N/A'}`);
  log(`  VERIFY-* 매칭: ${matches.length}건  sample: ${matches.slice(0, 5).map(d => d.order_id).join(', ')}\n`);
}

await queryOrder('조합 1: shop_id=10063 + sub_domain_seq=20', { shop_id: SHOP_ID, sub_domain_seq: '20' });
await queryOrder('조합 2: shop_id=10063 만', { shop_id: SHOP_ID });
await queryOrder('조합 3: sub_domain_seq=20 만', { sub_domain_seq: '20' });
await queryOrder('조합 4: order_id 직접 + sub_domain_seq=20', { order_id: newOrderId, sub_domain_seq: '20' });
await queryOrder('조합 5: order_id 직접 만', { order_id: newOrderId });

// ─── Step 3: get_etc_info ───
log('=== Step 3: get_etc_info 화주/판매처 목록 ===\n');

async function etcInfo(type) {
  log(`▶ search_type=${type}`);
  const formData = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'get_etc_info',
    search_type: type,
  });
  const r = await fetchWithTimeout(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  }, 8000);
  if (!r.ok) {
    log(`  ❌ ${r.text}\n`);
    return;
  }
  log(`  HTTP ${r.status}  응답(앞 600자): ${r.text.slice(0, 600)}\n`);
}

await etcInfo('sub_domain');
await etcInfo('shop');

log('=== 결론 ===');
log('Step 2 에서 매칭 > 0 인 조합 = get_order_info 정답 형식');
log('Step 3 에서 sub_domain 의 seq 값들 중 우리가 사용해야 할 화주 확인');
log('\n끝.\n');
