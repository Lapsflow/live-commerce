/**
 * GET /api/onewms/stats
 * Aggregated statistics for ONEWMS dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

      // Stock conflicts
      prisma.onewmsStockSync.count({
        where: { syncStatus: 'conflict' },
      }),

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

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch ONEWMS stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch statistics',
      },
      { status: 500 }
    );
  }
}
