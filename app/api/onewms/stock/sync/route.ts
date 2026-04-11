/**
 * POST /api/onewms/stock/sync
 * Manual trigger for stock synchronization
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { syncAllStocks } from '@/lib/services/onewms/stockSync';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, SUB_MASTER, or MASTER can trigger sync
    const allowedRoles = ['ADMIN', 'SUB_MASTER', 'MASTER'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    console.log('Manual stock sync triggered by:', session.user.email);

    // Run stock synchronization
    const stats = await syncAllStocks();

    return NextResponse.json({
      success: true,
      message: 'Stock sync completed successfully',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual stock sync failed:', error);
    const message = error instanceof Error ? error.message : 'Stock sync failed';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
