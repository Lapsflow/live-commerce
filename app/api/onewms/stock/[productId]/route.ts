import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, errors } from '@/lib/api/response';

/**
 * GET /api/onewms/stock/[productId]
 * 특정 상품의 재고 정보와 ONEWMS 동기화 상태 조회
 */
export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'SELLER'],
  async (
    req: NextRequest,
    user,
    { params }: { params: Promise<{ productId: string }> }
  ) => {
    try {
      const { productId } = await params;

    // 상품 조회
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        code: true,
        name: true,
        totalStock: true,
        onewmsCode: true,
      },
    });

    if (!product) {
      return errors.notFound('상품');
    }

    // 최신 재고 동기화 기록 조회
    // 속도 개선(2026-06-10): 이력은 "변동이 있을 때만" 기록되므로
    // lastSync.syncedAt = 마지막 변동 시각. 동기화 자체의 최신 실행 시각은
    // cron AuditLog 에서 별도 조회 (변동이 없어도 매 분 갱신됨).
    const [lastSync, lastCronRun] = await Promise.all([
      prisma.onewmsStockSync.findFirst({
        where: { productId },
        orderBy: { syncedAt: 'desc' },
        select: {
          syncedAt: true,
          availableQty: true,
          totalQty: true,
          difference: true,
          syncStatus: true,
        },
      }),
      prisma.auditLog.findFirst({
        where: { entityId: 'cron-stock-sync', ipAddress: 'cron' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

      // 표시용 동기화 시각 = max(마지막 변동, 마지막 cron 실행)
      const lastSyncedAt =
        lastCronRun?.createdAt && (!lastSync || lastCronRun.createdAt > lastSync.syncedAt)
          ? lastCronRun.createdAt
          : lastSync?.syncedAt ?? null;

      return ok({
        product,
        lastSync: lastSync
          ? {
              syncedAt: lastSyncedAt ?? lastSync.syncedAt,
              onewmsAvailableQty: lastSync.availableQty,
              onewmsTotalQty: lastSync.totalQty,
              difference: lastSync.difference,
              syncStatus: lastSync.syncStatus,
            }
          : null,
        hasConflict: lastSync?.syncStatus === 'conflict',
      });
    } catch (error) {
      console.error('Failed to fetch product stock:', error);
      return errors.internal('재고 정보 조회 실패');
    }
  }
);
