// 긴급 진단 — code 827 상품의 ONEWMS 실재고 vs 우리 DB 재고 비교
// 사용: node scripts/diag-product-827.mjs

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
const DATABASE_URL = env.DATABASE_URL;

async function fetchT(url, opts, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await (await fetch(url, { ...opts, signal: c.signal })).text(); }
  catch (e) { return `ERROR: ${e.message}`; }
  finally { clearTimeout(t); }
}

// ─── 1) 우리 DB 의 product 조회 (827 = code 일 가능성) ───
console.log('\n=== Step 1: 우리 DB 의 product 정보 (Vercel + Neon) ===\n');
console.log('우리 DB 직접 조회는 Vercel 화면 또는 prisma studio 로 확인하세요.');
console.log('product.code = "827" 인 row 의 onewmsCode 값이 ONEWMS 조회에 필요합니다.\n');
console.log('Vercel 우리 운영 화면 https://www.supermujin.ai 에서:');
console.log('  /products 페이지 → 검색창에 "827" → product 행에서 onewmsCode 확인\n');
console.log('또는 다음 명령으로 운영 DB 직접 조회 (psql 또는 prisma studio):');
console.log('  cd ~/Desktop/live-commerce && npx prisma studio');
console.log('  → Product 테이블 → code 컬럼 = "827" 필터 → onewmsCode 확인\n');

// ─── 2) ONEWMS 의 get_stock_info 직접 호출 (다양한 type 으로 시도) ───
console.log('=== Step 2: ONEWMS get_stock_info 직접 조회 ===\n');

async function getStock(type, ids) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'get_stock_info',
    type,
    ids,
    sub_domain_seq: SUB_DOMAIN_SEQ,
  });
  const r = await fetchT(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  return r;
}

// 다양한 식별자 시도
const candidates = ['827'];

for (const id of candidates) {
  for (const type of ['product_id', 'barcode', 'supply_code']) {
    console.log(`▶ get_stock_info type=${type} ids=${id}`);
    const r = await getStock(type, id);
    console.log(`  응답(앞 400자): ${r.slice(0, 400)}\n`);
  }
}

// ─── 3) get_order_info 로 한국무진유통 영역에서 827 관련 주문 검색 ───
console.log('=== Step 3: 한국무진유통 영역의 product_id=827 또는 [827] 검색 ===\n');
const start = new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10);
const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const fd3 = new URLSearchParams({
  partner_key: PARTNER_KEY,
  domain_key: DOMAIN_KEY,
  action: 'get_order_info',
  date_type: 'collect_date',
  start_date: start,
  end_date: end,
  limit: '20',
  shop_id: SHOP_ID,
  sub_domain_seq: SUB_DOMAIN_SEQ,
  product_id: '827',
});
const r3 = await fetchT(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: fd3.toString(),
});
console.log(`▶ product_id=827 검색 응답(앞 600자): ${r3.slice(0, 600)}\n`);

console.log('=== 조치 가이드 ===');
console.log('1. Step 1 에서 product 827 의 onewmsCode 확인 (예: "27015")');
console.log('2. Step 2 에서 그 onewmsCode 로 get_stock_info 호출 응답 확인');
console.log('3. WMS 응답의 실재고 vs 슈퍼무진 표시 6개 비교');
console.log('4. 즉시 강제 sync:');
console.log('   운영 화면에서 MASTER 로 로그인 → /admin/sync-monitor 또는');
console.log('   curl 로 직접 POST /api/onewms/stock/sync { "productId": "<우리 DB 의 product.id>" }\n');
