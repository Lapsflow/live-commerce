/**
 * ONEWMS 가격 동기화 진단 (1406번 상품)
 *
 * 목적: 특정 상품의 공급가가 ONEWMS에서 수정되었을 때
 *      슈퍼무진 DB에 반영되는 과정을 전체 진단
 *
 * 4가지 검증:
 * A) 슈퍼무진 DB의 1406번 현재 상태 (productCode, onewmsCode, supplyPrice)
 * B) ONEWMS API 직접 호출 시 1406번 공급가
 * C) 가격 sync cron 동작 이력
 * D) 자동 케이스 판별 (sync 안 됨 / ONEWMS 캐시 / 이미 반영 / 페이지 한도)
 *
 * 사용:
 *   pnpm tsx scripts/diagnose-product-price.ts 1406
 */

import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { createOnewmsClient } from '@/lib/onewms';
import 'dotenv/config';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon({ connectionString: url } as any);
const prisma = new PrismaClient({ adapter } as unknown as ConstructorParameters<typeof PrismaClient>[0]);

interface DiagnosisResult {
  productCode: string;
  // A) 슈퍼무진 DB
  dbProduct: {
    id?: string;
    code?: string;
    onewmsCode?: string;
    name?: string;
    supplyPrice?: number;
    sellPrice?: number;
    updatedAt?: Date;
    found: boolean;
  };
  // B) ONEWMS API 직접 호출
  onewmsProduct: {
    product_id?: string;
    name?: string;
    supply_price?: string;
    shop_price?: string;
    org_price?: string;
    found: boolean;
  };
  // C) 최근 sync 이력
  lastSync?: {
    syncedAt: Date;
    syncStatus: string;
    productCode: string;
  };
  // D) 결론 (A/B/C/D 중 하나)
  conclusion: 'A' | 'B' | 'C' | 'D' | 'ERROR';
  conclusionMessage: string;
  recommendation: string;
}

async function diagnosePriceSync(productCode: string): Promise<DiagnosisResult> {
  const result: DiagnosisResult = {
    productCode,
    dbProduct: { found: false },
    onewmsProduct: { found: false },
    conclusion: 'ERROR',
    conclusionMessage: '',
    recommendation: '',
  };

  console.log('='.repeat(80));
  console.log(`🔍 가격 동기화 진단: 상품 ${productCode}`);
  console.log('='.repeat(80));

  // ============================================
  // A) 슈퍼무진 DB에서 상품 찾기
  // ============================================
  console.log('\n📋 [A] 슈퍼무진 DB 조회...');

  const dbProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { code: productCode },
        { onewmsCode: productCode },
        { code: `WMS-${productCode}` },
      ],
    },
    select: {
      id: true,
      code: true,
      onewmsCode: true,
      name: true,
      supplyPrice: true,
      sellPrice: true,
      originalPrice: true,
      updatedAt: true,
    },
  });

  if (dbProduct) {
    result.dbProduct = {
      id: dbProduct.id,
      code: dbProduct.code,
      onewmsCode: dbProduct.onewmsCode || 'N/A',
      name: dbProduct.name,
      supplyPrice: dbProduct.supplyPrice,
      sellPrice: dbProduct.sellPrice,
      updatedAt: dbProduct.updatedAt,
      found: true,
    };
    console.log(`✅ 찾음: ${dbProduct.name}`);
    console.log(`   - ID: ${dbProduct.id}`);
    console.log(`   - code: ${dbProduct.code}`);
    console.log(`   - onewmsCode: ${dbProduct.onewmsCode || 'N/A'}`);
    console.log(`   - supplyPrice: ${dbProduct.supplyPrice?.toLocaleString()}원`);
    console.log(`   - sellPrice: ${dbProduct.sellPrice?.toLocaleString()}원`);
    console.log(`   - updatedAt: ${dbProduct.updatedAt?.toISOString()}`);
  } else {
    console.log(`❌ 상품 ${productCode}를 DB에서 찾을 수 없습니다.`);
    console.log('   시도한 검색: code, onewmsCode, code (WMS-형식)');
  }

  // ============================================
  // B) ONEWMS API 직접 호출
  // ============================================
  console.log('\n📡 [B] ONEWMS API 조회...');

  if (!process.env.ONEWMS_PARTNER_KEY || !process.env.ONEWMS_DOMAIN_KEY) {
    console.log('⚠️  ONEWMS_PARTNER_KEY 또는 ONEWMS_DOMAIN_KEY 미설정');
    console.log('   SKIP: B) ONEWMS API 조회');
  } else {
    try {
      const client = createOnewmsClient();
      let found = false;

      // 페이지 1-20 (최대 2,000개 상품)
      for (let page = 1; page <= 20; page++) {
        const { data: products } = await client.getProductList(page, 100);

        const foundProduct = products.find(
          (p) => p.product_id === productCode || p.product_id === `${productCode}`
        );

        if (foundProduct) {
          result.onewmsProduct = {
            product_id: foundProduct.product_id,
            name: foundProduct.name,
            supply_price: String(foundProduct.supply_price || '0'),
            shop_price: String(foundProduct.shop_price || '0'),
            org_price: String(foundProduct.org_price || '0'),
            found: true,
          };
          console.log(`✅ 찾음 (page ${page}): ${foundProduct.name}`);
          console.log(`   - product_id: ${foundProduct.product_id}`);
          console.log(`   - supply_price: ${foundProduct.supply_price?.toLocaleString()}원`);
          console.log(`   - shop_price: ${foundProduct.shop_price?.toLocaleString()}원`);
          console.log(`   - org_price: ${foundProduct.org_price?.toLocaleString()}원`);
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(`❌ ONEWMS API에서 product_id=${productCode}를 찾을 수 없습니다.`);
        console.log('   (페이지 20개 = 최대 2,000개 상품 범위 내)');
      }
    } catch (error) {
      console.error(`❌ ONEWMS API 호출 실패:`, error instanceof Error ? error.message : error);
    }
  }

  // ============================================
  // C) 최근 sync 이력
  // ============================================
  console.log('\n⏰ [C] 최근 Sync 이력...');

  if (result.dbProduct.found && result.dbProduct.id) {
    const lastSync = await prisma.onewmsStockSync.findFirst({
      where: { productId: result.dbProduct.id },
      select: {
        productCode: true,
        syncedAt: true,
        syncStatus: true,
      },
      orderBy: { syncedAt: 'desc' },
    });

    if (lastSync) {
      result.lastSync = lastSync;
      console.log(`✅ 최근 Sync: ${lastSync.syncedAt.toISOString()}`);
      console.log(`   - Status: ${lastSync.syncStatus}`);
    } else {
      console.log('⚠️  이 상품의 동기화 이력이 없습니다.');
    }
  } else {
    console.log('⚠️  DB 상품을 찾을 수 없어 이력 조회 불가');
  }

  // ============================================
  // D) 결론 자동 판별
  // ============================================
  console.log('\n📊 [D] 결론...');

  if (!result.dbProduct.found) {
    result.conclusion = 'D';
    result.conclusionMessage =
      '상품이 슈퍼무진 DB에 없음 — 매핑 누락 또는 productCode 형식 문제';
    result.recommendation =
      '1) productCode/onewmsCode 형식 재확인\n   2) ONEWMS 측에서 정말 상품이 존재하는지 확인\n   3) 필요시 수동 매핑 필요';
  } else if (!result.onewmsProduct.found) {
    result.conclusion = 'D';
    result.conclusionMessage =
      'ONEWMS API 응답에 상품이 없음 — 페이지 한도 또는 API 한도 초과 가능';
    result.recommendation =
      '1) lib/services/onewms/productImport.ts 의 page 한도 (현재 20 = 2000개) 확인\n   2) ONEWMS API 캐시/지연 가능성 → 1분 대기 후 재확인\n   3) ONEWMS 측 상품 상태 확인';
  } else {
    // ONEWMS에 있음 + DB에 있음
    const onewmsSupplyPrice = parseInt(result.onewmsProduct.supply_price || '0', 10);
    const dbSupplyPrice = result.dbProduct.supplyPrice || 0;

    if (onewmsSupplyPrice === dbSupplyPrice) {
      result.conclusion = 'C';
      result.conclusionMessage = '✅ 가격이 이미 동기화되어 있습니다.';
      result.recommendation =
        '대표님 브라우저 캐시 새로고침 (Ctrl+Shift+Delete 또는 Cmd+Shift+Delete)을 시도해주세요.';
    } else if (onewmsSupplyPrice === 11900 && dbSupplyPrice === 5100) {
      result.conclusion = 'A';
      result.conclusionMessage =
        '❌ 우리 DB는 5,100원이지만 ONEWMS는 11,900원 — 동기화가 실패한 상태입니다.';
      result.recommendation =
        '1) /api/cron/stock-sync 가 정상 동작하는지 확인\n   2) lib/services/onewms/productImport.ts:syncProductPricesFromOnewms 가 1406을 제대로 찾는지 디버깅\n   3) HEADQUARTERS 상품만 동기화되므로 productType 확인 필수\n   4) cron 로그에 "Price sync done: X/Y updated" 메시지 확인';
    } else {
      result.conclusion = 'B';
      result.conclusionMessage = `⚠️  ONEWMS 측에서 예상과 다른 값(${onewmsSupplyPrice}원)을 반환`;
      result.recommendation =
        `1) ONEWMS 측에 상품 ${result.onewmsProduct.product_id} 의 supply_price 값을 다시 확인해주세요.\n   2) ONEWMS 캐시 가능성 → 1분 대기 후 재확인\n   3) 예상값: 11,900원, 현재값: ${onewmsSupplyPrice}원`;
    }
  }

  console.log(`\n결론: [${result.conclusion}]`);
  console.log(`메시지: ${result.conclusionMessage}`);
  console.log(`\n권장 조치:`);
  console.log(result.recommendation);

  console.log('\n' + '='.repeat(80));

  return result;
}

async function main() {
  const productCode = process.argv[2] || '1406';

  if (!productCode) {
    console.error('사용법: pnpm tsx scripts/diagnose-product-price.ts <productCode>');
    console.error('예: pnpm tsx scripts/diagnose-product-price.ts 1406');
    process.exit(1);
  }

  try {
    await diagnosePriceSync(productCode);
  } catch (error) {
    console.error('진단 중 오류:', error);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('스크립트 실행 중 오류:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
