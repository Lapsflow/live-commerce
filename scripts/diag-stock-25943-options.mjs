// product_id=25943 의 ONEWMS get_stock_info 를 다양한 옵션 조합으로 호출
// 목표: UI 의 "1개" 와 일치하는 옵션 조합 발견 → 우리 코드 정정

import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const PARTNER_KEY = env.ONEWMS_PARTNER_KEY;
const DOMAIN_KEY = env.ONEWMS_DOMAIN_KEY;
const SUB_DOMAIN_SEQ = env.ONEWMS_SUB_DOMAIN_SEQ || '62';
const API_URL = env.ONEWMS_API_URL;
const TARGET = '25943';

async function callStock(label, params) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY,
    action: 'get_stock_info', type: 'product_id', ids: TARGET,
    ...params,
  });
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  // stock 값 추출
  let stockSum = 'N/A';
  let warehouses = [];
  if (parsed?.data?.[TARGET]?.stock) {
    warehouses = Object.entries(parsed.data[TARGET].stock).map(([k, v]) => `wh${k}=${v.stock}`);
    stockSum = Object.values(parsed.data[TARGET].stock).reduce((s, w) => s + (Number(w.stock) || 0), 0);
  }
  console.log(`▶ ${label}`);
  console.log(`  → stock 합산=${stockSum}  warehouses: [${warehouses.join(', ')}]`);
  if (parsed?.error !== undefined && parsed.error !== 0) {
    console.log(`  ⚠️ error=${parsed.error}  msg="${parsed.msg}"`);
  }
  console.log(`  raw: ${text.slice(0, 250)}\n`);
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`  product_id=${TARGET} get_stock_info 옵션 조합 검증`);
console.log(`══════════════════════════════════════════════\n`);

// ─── 기본 (현재 우리 코드) ───
console.log('━━━ 기본 옵션 (현재 우리 코드) ━━━');
await callStock('기본 (옵션 없음)', {});

// ─── include_ready_trans 변형 (접수/송장재고 포함 여부) ───
console.log('━━━ include_ready_trans (접수/송장 포함 여부) ━━━');
await callStock('include_ready_trans=0 (즉시 가용재고만, 기본)', { include_ready_trans: '0' });
await callStock('include_ready_trans=1 (접수/송장 포함)', { include_ready_trans: '1' });

// ─── stock_type 변형 (재고 분류) ───
console.log('━━━ stock_type (재고 분류) ━━━');
await callStock('stock_type=0 (정상재고, 기본)', { stock_type: '0' });
await callStock('stock_type=1', { stock_type: '1' });
await callStock('stock_type=2', { stock_type: '2' });

// ─── warehouse_seq 명시 ───
console.log('━━━ warehouse_seq 명시 ━━━');
await callStock('warehouse_seq=1', { warehouse_seq: '1' });

// ─── sub_domain_seq 추가 ───
console.log('━━━ sub_domain_seq=62 추가 ━━━');
await callStock('sub_domain_seq=62', { sub_domain_seq: SUB_DOMAIN_SEQ });

// ─── 조합 ───
console.log('━━━ 조합 옵션 ━━━');
await callStock('include_ready_trans=1 + sub_domain_seq=62', { include_ready_trans: '1', sub_domain_seq: SUB_DOMAIN_SEQ });
await callStock('include_ready_trans=1 + warehouse_seq=1', { include_ready_trans: '1', warehouse_seq: '1' });
await callStock('include_ready_trans=1 + stock_type=0 + warehouse_seq=1', { include_ready_trans: '1', stock_type: '0', warehouse_seq: '1' });

// ─── 재고 이력 (가용재고 분리 단서) ───
console.log('━━━ get_stock_tx_info 재고 이력 (참고용) ━━━');
const fd2 = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY,
  action: 'get_stock_tx_info', page: '1', limit: '5',
});
const r2 = await fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: fd2.toString(),
});
const t2 = await r2.text();
console.log(`raw (앞 500자): ${t2.slice(0, 500)}\n`);

// ─── 한국무진유통 영역의 미배송 주문 (재고 차감 가능성) ───
console.log('━━━ 한국무진유통 영역의 미배송 주문 (재고 예약 가능성) ━━━');
const start = new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10);
const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const fd3 = new URLSearchParams({
  partner_key: PARTNER_KEY, domain_key: DOMAIN_KEY,
  action: 'get_order_info', date_type: 'collect_date',
  start_date: start, end_date: end, limit: '20',
  sub_domain_seq: SUB_DOMAIN_SEQ, product_id: TARGET,
  status: '1',  // 1=접수 (배송 전)
});
const r3 = await fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: fd3.toString(),
});
const t3 = await r3.text();
try {
  const p = JSON.parse(t3);
  console.log(`▶ product_id=${TARGET} 의 status=1 (접수, 배송전) 주문 ${p.total || 0}건`);
  if (p.data?.length > 0) {
    let totalReserved = 0;
    for (const o of p.data.slice(0, 5)) {
      const qty = o.order_products?.[0]?.qty || o.qty;
      totalReserved += Number(qty || 0);
      console.log(`    ${o.order_id} qty=${qty} status=${o.status} ${o.recv_name}`);
    }
    console.log(`  ★ 접수상태 미출고 총량 = ${totalReserved} (이게 가용재고 차감분일 가능성)`);
  }
} catch {
  console.log(`raw: ${t3.slice(0, 400)}`);
}

console.log('\n══════════════════════════════════════════════');
console.log('  분석 가이드');
console.log('══════════════════════════════════════════════');
console.log('어떤 옵션 조합이 stock=1 을 반환하면 그 조합이 ONEWMS UI 와 일치.');
console.log('그 조합대로 lib/services/onewms/stockSync.ts:55 의 getStockInfo 호출 정정.');
console.log('만약 모든 조합이 6 이면 → ONEWMS API 자체가 다른 값. 한국무진 회신 필수.');
console.log('만약 접수 미출고 5건 발견 → 6 - 5 = 1 (가용재고). ONEWMS UI 가 가용재고 표시.\n');
