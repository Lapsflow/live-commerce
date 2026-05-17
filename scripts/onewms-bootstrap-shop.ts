#!/usr/bin/env tsx

/**
 * ONEWMS Bootstrap Script
 *
 * ONEWMS 연동 전에 shop_id, trans, supply, warehouse 정보를 확인하는 스크립트
 * 운영자가 이 스크립트를 실행해서 .env.local 에 ONEWMS_SHOP_ID 를 설정
 *
 * Usage:
 *   pnpm tsx scripts/onewms-bootstrap-shop.ts
 */

import { OnewmsClient } from '../lib/onewms/client';

async function bootstrap() {
  try {
    const client = new OnewmsClient({
      partnerKey: process.env.ONEWMS_PARTNER_KEY || '',
      domainKey: process.env.ONEWMS_DOMAIN_KEY || '',
      apiUrl: process.env.ONEWMS_API_URL,
    });

    console.log('\n🚀 ONEWMS 부트스트랩 시작...\n');

    // 1. 판매처 정보 조회
    console.log('📍 [1/4] 판매처(shop) 정보 조회...');
    const shops = await client.getEtcInfo('shop');
    console.log('\n✅ 판매처 목록:');
    console.table(shops, ['code', 'seq', 'name']);

    // 2. 택배사 정보 조회
    console.log('\n📍 [2/4] 택배사(trans) 정보 조회...');
    const trans = await client.getEtcInfo('trans');
    console.log('\n✅ 택배사 목록:');
    console.table(trans, ['code', 'name']);

    // 3. 공급업체 정보 조회
    console.log('\n📍 [3/4] 공급업체(supply) 정보 조회...');
    const supplies = await client.getEtcInfo('supply');
    console.log('\n✅ 공급업체 목록:');
    console.table(supplies, ['code', 'name']);

    // 4. 창고 정보 조회
    console.log('\n📍 [4/4] 창고(warehouse) 정보 조회...');
    const warehouses = await client.getEtcInfo('warehouse');
    console.log('\n✅ 창고 목록:');
    console.table(warehouses, ['seq', 'name']);

    // 최종 안내
    console.log('\n' + '='.repeat(80));
    console.log('✅ 부트스트랩 완료!');
    console.log('='.repeat(80));
    console.log(`
📋 다음 단계:

1. 위 "판매처 목록"에서 우리 판매처의 코드(code) 또는 seq 확인

2. .env.local 에 추가:
   ONEWMS_SHOP_ID="[우리 판매처 코드]"

   예시:
   ONEWMS_SHOP_ID="usermanual"
   또는
   ONEWMS_SHOP_ID="01"

3. Vercel 운영 환경에도 동일하게 설정:
   https://vercel.com/your-team/live-commerce
   → Settings → Environment Variables
   → ONEWMS_SHOP_ID="[값]"

4. 배포 후 발주 컨펌 시 ONEWMS 동기화 테스트

⚠️ ONEWMS_SHOP_ID 를 설정하지 않으면 발주 컨펌이 실패합니다!
    `);
  } catch (error) {
    console.error('❌ 에러:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

bootstrap();
