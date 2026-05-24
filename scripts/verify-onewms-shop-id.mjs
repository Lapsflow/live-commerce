// v4 — shop_id=10063 의 실체 검증
// 1. get_etc_info?search_type=shop 전체 dump → 10063 의 진짜 name 확인
// 2. get_etc_info?search_type=sub_domain 전체 dump → 10063 이 어느 화주(sub_domain)에 속하는지
// 3. 10063 이 어디에도 없으면 우리 shop_id 자체가 잘못된 것

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

console.log(`\n=== 우리 .env.local 의 SHOP_ID = "${SHOP_ID}" ===\n`);

async function fetchTimeout(url, opts, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return { text: await (await fetch(url, { ...opts, signal: ctrl.signal })).text() }; }
  catch (e) { return { text: `ERROR: ${e.message}` }; }
  finally { clearTimeout(t); }
}

async function getEtc(searchType) {
  const fd = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action: 'get_etc_info',
    search_type: searchType,
  });
  const r = await fetchTimeout(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  });
  return r.text;
}

// ─── 1. shop 전체 ───
console.log('=== Step 1: get_etc_info?search_type=shop 전체 ===');
const shopRaw = await getEtc('shop');
writeFileSync('/tmp/onewms-shop.json', shopRaw);
console.log(`전체 응답 저장: /tmp/onewms-shop.json (${shopRaw.length} bytes)\n`);

try {
  const shops = JSON.parse(shopRaw).data || [];
  console.log(`판매처(shop) 총 ${shops.length}개`);
  const found = shops.find(s => String(s.code) === String(SHOP_ID));
  if (found) {
    console.log(`✅ shop_id=${SHOP_ID} 발견! name="${found.name}"`);
  } else {
    console.log(`❌ shop_id=${SHOP_ID} 가 shop 목록에 없음!`);
    // 한국무진 / supermujin / 슈퍼무진 / mujin 으로 검색
    const candidates = shops.filter(s =>
      String(s.name).includes('무진') ||
      String(s.name).toLowerCase().includes('mujin') ||
      String(s.name).toLowerCase().includes('supermujin') ||
      String(s.name).includes('슈퍼')
    );
    console.log(`\n🔎 "무진/슈퍼/mujin" 키워드 후보 ${candidates.length}개:`);
    for (const c of candidates) console.log(`  code=${c.code}  name="${c.name}"`);
  }
} catch (e) {
  console.log(`JSON 파싱 실패: ${e.message}`);
  console.log(`응답 앞 500자: ${shopRaw.slice(0, 500)}`);
}

console.log('');

// ─── 2. sub_domain 전체 ───
console.log('=== Step 2: get_etc_info?search_type=sub_domain 전체 ===');
const subRaw = await getEtc('sub_domain');
writeFileSync('/tmp/onewms-sub-domain.json', subRaw);
console.log(`전체 응답 저장: /tmp/onewms-sub-domain.json (${subRaw.length} bytes)\n`);

try {
  const subs = JSON.parse(subRaw).data || [];
  console.log(`화주(sub_domain) 총 ${subs.length}개\n`);

  // 우리 shop_id 가 어느 sub_domain 의 shop 배열에 있는지
  let matchingSub = null;
  for (const sub of subs) {
    if (Array.isArray(sub.shop) && sub.shop.includes(String(SHOP_ID))) {
      matchingSub = sub;
      break;
    }
  }
  if (matchingSub) {
    console.log(`✅ shop_id=${SHOP_ID} 는 sub_domain code=${matchingSub.code} ("${matchingSub.name}") 에 속함`);
    console.log(`   → get_order_info 호출 시 sub_domain_seq=${matchingSub.code} 사용`);
  } else {
    console.log(`❌ shop_id=${SHOP_ID} 가 어느 sub_domain 의 shop 배열에도 없음!`);
    // 무진 검색
    const candidates = subs.filter(s =>
      String(s.name).includes('무진') ||
      String(s.name).toLowerCase().includes('mujin') ||
      String(s.name).includes('슈퍼')
    );
    console.log(`\n🔎 sub_domain "무진/슈퍼/mujin" 키워드 후보 ${candidates.length}개:`);
    for (const c of candidates) console.log(`  code=${c.code}  name="${c.name}"  shops=${JSON.stringify(c.shop)}`);
  }
} catch (e) {
  console.log(`JSON 파싱 실패: ${e.message}`);
  console.log(`응답 앞 500자: ${subRaw.slice(0, 500)}`);
}

console.log('\n=== 결론 ===');
console.log('1. shop_id=10063 이 ONEWMS 의 shop 목록 또는 sub_domain.shop 배열에 있는지');
console.log('2. 없으면 → .env.local 의 ONEWMS_SHOP_ID 값 자체를 한국무진 측에서 확인받아야 함');
console.log('3. 있으면 → 그 sub_domain.code 를 sub_domain_seq 로 사용하도록 코드 수정\n');
