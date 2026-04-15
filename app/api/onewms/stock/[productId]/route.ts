import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, errors } from '@/lib/api/response';

/**
 * GET /api/onewms/stock/[productId]
 * 특정 상품의 재고 정보와 ONEWMS 동기화 상태 조회
 */
export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'ADMIN', 'SELLER'],
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
    const lastSync = await prisma.onewmsStockSync.findFirst({
      where: { productId },
      orderBy: { syncedAt: 'desc' },
      select: {
        syncedAt: true,
        availableQty: true,
        totalQty: true,
        difference: true,
        syncStatus: true,
      },
    });

      return ok({
        product,
        lastSync: lastSync
          ? {
              syncedAt: lastSync.syncedAt,
              onewmsAvailableQty: lastSync.availableQty,
              onewmsTotalQty: lastSync.totalQty,
              difference: lastSync.difference,
              syncStatus: lastSync.syncStatus,
            }
          : null,
        hasConflict: lastSync?.syncStatus === 'conflict',
      });
    } catch (error: any) {
      console.error('Failed to fetch product stock:', error);
      return errors.internal('재고 정보 조회 실패');
    }
  }
);
