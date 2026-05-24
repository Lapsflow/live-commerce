// v7 — order_id 형식 + 응답 raw 구조 검증
//   - 시도 A: 순수 숫자 order_id (ONEWMS 정상 데이터와 동일 형식)
//   - 시도 B: 우리 기존 형식 LIVE-XXXX
//   - 응답 raw 전체 보존
//   - get_order_info 의 한 건을 JSON.stringify(d, null, 2) 로 응답 구조 dump

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

// ─── Step 1: 응답 구조 dump — 한국무진유통 영역 첫 1건의 모든 필드 ───
console.log('\n=== Step 1: get_order_info 응답 1건의 전체 구조 dump ===\n');
const start = new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10);
const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const fd1 = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'get_order_info',
  date_type: 'collect_date', start_date: start, end_date: end, limit: '3',
  shop_id: SHOP_ID, sub_domain_seq: '62',
});
const r1 = await fetchT(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: fd1.toString(),
});
writeFileSync('/tmp/onewms-order-dump.json', r1);
try {
  const p = JSON.parse(r1);
  console.log(`전체 응답 키: ${Object.keys(p).join(', ')}`);
  console.log(`data 배열 길이: ${p.data?.length || 0}`);
  if (p.data?.[0]) {
    console.log('\n첫 번째 주문의 모든 필드:');
    console.log(JSON.stringify(p.data[0], null, 2));
  }
} catch (e) {
  console.log(`파싱 실패: ${r1.slice(0, 500)}`);
}

// ─── Step 2: 두 가지 order_id 형식으로 set_orders ───
console.log('\n=== Step 2: order_id 형식별 set_orders 비교 ===\n');
const ts = Date.now();
const collectDate = new Date().toISOString().slice(2, 10);

const candidates = [
  {
    label: '시도 A: 순수 숫자 11자리 (ONEWMS 정상 형식)',
    order_id: `999${ts.toString().slice(-8)}`,
  },
  {
    label: '시도 B: 우리 기존 LIVE-XXX 형식',
    order_id: `LIVE-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${ts.toString(36).toUpperCase().slice(-5)}`,
  },
  {
    label: '시도 C: 숫자 14자리 (YYYYMMDDHHMMSS)',
    order_id: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
  },
];

for (const c of candidates) {
  const qs = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'set_orders',
    shop_id: SHOP_ID, collect_date: collectDate,
  });
  const r = await fetchT(`${API_URL}?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      order_id: c.order_id,
      shop_product_id: '705',  // 정상 데이터에서 본 [705]굿바이오 하이업 의 코드 추정
      qty: 1,
      recv_name: '검증ORDER',
      recv_mobile: '01000000077',
      recv_address: '검증로 7',
      product_name: '검증 더미',
    }]),
  });
  c.orderIdSent = c.order_id;
  c.response = r;
  console.log(`▶ ${c.label}`);
  console.log(`  order_id: ${c.order_id}`);
  console.log(`  응답: ${r}\n`);
}

await new Promise(r => setTimeout(r, 5000));

// ─── Step 3: 각 order_id 로 조회 ───
console.log('=== Step 3: 각 order_id 로 직접 조회 ===\n');
for (const c of candidates) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY, action: 'get_order_info',
    date_type: 'collect_date', start_date: start, end_date: end, limit: '5',
    shop_id: SHOP_ID, sub_domain_seq: '62',
    order_id: c.orderIdSent,
  });
  const r = await fetchT(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  try {
    const p = JSON.parse(r);
    console.log(`▶ ${c.label}`);
    console.log(`  order_id=${c.orderIdSent}  →  total=${p.total}  data.len=${p.data?.length || 0}`);
    if (p.data?.[0]) {
      console.log(`  ✅ 등록 확인!  fields: ${Object.keys(p.data[0]).slice(0, 10).join(', ')}...`);
    } else {
      console.log(`  ❌ 조회 안 됨`);
    }
    console.log('');
  } catch (e) {
    console.log(`  파싱 실패: ${r.slice(0, 200)}\n`);
  }
}

console.log('=== 결론 ===');
console.log('Step 1: ONEWMS get_order_info 응답의 진짜 필드 구조 확인');
console.log('Step 2/3: 어느 order_id 형식이 실제 등록되는지 (총 1건이라도 등록되면 그 형식 채택)');
console.log('만약 셋 다 0건 → 우리 partner_key 가 set_orders 쓰기 권한 없음 → 한국무진에 권한 요청\n');
