/**
 * 누적된 재고 충돌 일괄 자동 해결
 *
 * 정책 (2026-05-13 대표님 결정 — 옵션 A):
 *   - ONEWMS 100% 일치 강제
 *   - 기존에 conflict 상태로 누적된 모든 OnewmsStockSync row 를
 *     ONEWMS 값으로 자동 적용 + syncStatus='resolved' 로 변경
 *   - Product.totalStock 을 ONEWMS 값(availableQty)으로 덮어쓰기
 *
 * 사용:
 *   pnpm tsx scripts/resolve-all-stock-conflicts.ts            # dry-run
 *   pnpm tsx scripts/resolve-all-stock-conflicts.ts --apply    # 실제 적용
 *
 * 영향:
 *   - 본사 제품(HEADQUARTERS)의 totalStock 이 ONEWMS 값으로 일괄 갱신됨
 *   - OnewmsStockSync 의 conflict row 들이 resolved 로 변경됨
 *   - 위젯 및 충돌 목록에 0건으로 표시됨
 */

import { prisma } from '../lib/db/prisma';

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('='.repeat(70));
  console.log(apply ? '🔥 APPLY MODE — 실제 적용' : '🔍 DRY-RUN — 시뮬레이션만');
  console.log('='.repeat(70));

  // 1) DISTINCT 상품 기준으로 최신 conflict row 들 조회
  const latestConflicts = await prisma.$queryRaw<
    Array<{
      productId: string;
      productCode: string;
      availableQty: number;
      localQty: number;
      difference: number;
    }>
  >`
    SELECT DISTINCT ON ("productId")
      oss."productId",
      oss."productCode",
      oss."availableQty",
      oss."localQty",
      oss."difference"
    FROM "OnewmsStockSync" oss
    WHERE oss."syncStatus" = 'conflict'
    ORDER BY oss."productId", oss."syncedAt" DESC
  `;

  console.log(`\n📋 충돌 중인 고유 상품: ${latestConflicts.length}개`);
  console.log('-'.repeat(70));

  if (latestConflicts.length === 0) {
    console.log('✅ 처리할 충돌이 없습니다.');
    return;
  }

  // 차이 크기 분포 분석
  const distribution = {
    '0': 0,
    '1-5': 0,
    '6-50': 0,
    '51-200': 0,
    '200+': 0,
  };
  let totalAbsDiff = 0;

  for (const c of latestConflicts) {
    const abs = Math.abs(c.difference);
    totalAbsDiff += abs;
    if (abs === 0) distribution['0'] += 1;
    else if (abs <= 5) distribution['1-5'] += 1;
    else if (abs <= 50) distribution['6-50'] += 1;
    else if (abs <= 200) distribution['51-200'] += 1;
    else distribution['200+'] += 1;
  }

  console.log('차이 분포:');
  for (const [range, count] of Object.entries(distribution)) {
    console.log(`  ${range.padEnd(8)}: ${count}건`);
  }
  console.log(`평균 절댓값 차이: ${Math.round(totalAbsDiff / latestConflicts.length)}`);

  // 상위 10건 상세
  console.log('\n상위 10건 미리보기 (차이 큰 순):');
  const top10 = [...latestConflicts]
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 10);
  for (const c of top10) {
    const sign = c.difference > 0 ? '+' : '';
    console.log(
      `  ${c.productCode.padEnd(15)} Local=${String(c.localQty).padStart(5)} → ONEWMS=${String(c.availableQty).padStart(5)} (차이 ${sign}${c.difference})`
    );
  }

  if (!apply) {
    console.log('\n✋ DRY-RUN 종료. 실제 적용하려면 --apply 옵션을 추가하세요.');
    console.log('   pnpm tsx scripts/resolve-all-stock-conflicts.ts --apply');
    return;
  }

  // 2) Product.totalStock 일괄 업데이트 + OnewmsStockSync conflict row 들 resolved 처리
  console.log('\n🔄 적용 중...');
  let updated = 0;
  let failed = 0;

  for (const c of latestConflicts) {
    try {
      await prisma.$transaction(async (tx) => {
        // Product.totalStock 을 ONEWMS 값으로
        await tx.product.update({
          where: { id: c.productId },
          data: { totalStock: c.availableQty },
        });

        // 해당 product 의 모든 conflict row 들 resolved 로 변경
        await tx.onewmsStockSync.updateMany({
          where: {
            productId: c.productId,
            syncStatus: 'conflict',
          },
          data: {
            syncStatus: 'resolved',
          },
        });
      });
      updated += 1;
      if (updated % 20 === 0) {
        console.log(`  진행: ${updated} / ${latestConflicts.length}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  ❌ ${c.productCode} 실패:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ 완료: ${updated}/${latestConflicts.length} 적용 (실패 ${failed}건)`);
  console.log(`📊 위젯의 "재고 충돌" 카운트가 잠시 후 0건으로 표시됩니다.`);
  console.log('='.repeat(70));
}

main()
  .catch((err) => {
    console.error('스크립트 실행 중 오류:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
