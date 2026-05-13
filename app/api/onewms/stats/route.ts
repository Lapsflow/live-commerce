/**
 * GET /api/onewms/stats
 * Aggregated statistics for ONEWMS dashboard
 */

import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, errors } from '@/lib/api/response';

export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'SELLER'],
  async (req: NextRequest) => {
    try {

    // Get statistics in parallel
    const [
      totalSynced,
      pendingOrders,
      failedOrders,
      shippedOrders,
      stockConflicts,
      recentSyncs,
    ] = await Promise.all([
      // Total orders synced
      prisma.onewmsOrderMapping.count(),

      // Pending orders
      prisma.onewmsOrderMapping.count({
        where: { status: 'pending' },
      }),

      // Failed orders
      prisma.onewmsOrderMapping.count({
        where: {
          OR: [
            { status: 'failed' },
            { status: 'manual_intervention' },
          ],
        },
      }),

      // Shipped orders
      prisma.onewmsOrderMapping.count({
        where: { status: 'shipped' },
      }),

      // Stock conflicts — 고유 상품 기준 카운트 (2026-05-13 hotfix)
      // 기존: OnewmsStockSync 의 모든 conflict row 카운트 (중복 포함, 13,000+ 부풀려짐)
      // 수정: DISTINCT productId 기준으로 실제 충돌 중인 상품 수만 반영
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT "productId") AS count
        FROM "OnewmsStockSync"
        WHERE "syncStatus" = 'conflict'
      `.then((rows) => Number(rows[0]?.count ?? 0)),

      // Recent stock syncs (last 24 hours)
      prisma.onewmsStockSync.findMany({
        where: {
          syncedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { syncedAt: 'desc' },
        take: 1,
      }),
    ]);

    // Calculate success rate
    const successRate =
      totalSynced > 0
        ? ((totalSynced - failedOrders) / totalSynced) * 100
        : 100;

    // Last sync time
    const lastStockSync =
      recentSyncs.length > 0 ? recentSyncs[0].syncedAt : null;

      return ok({
        orders: {
          total: totalSynced,
          pending: pendingOrders,
          failed: failedOrders,
          shipped: shippedOrders,
          successRate: Math.round(successRate * 10) / 10,
        },
        stock: {
          conflicts: stockConflicts,
          lastSync: lastStockSync,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to fetch ONEWMS stats:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch statistics';
      return errors.internal(message);
    }
  }
);
