/**
 * POST /api/onewms/stock/sync
 * Manual trigger for stock synchronization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncAllStocks } from '@/lib/services/onewms/stockSync';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, SUB_MASTER, or MASTER can trigger sync
    const allowedRoles = ['ADMIN', 'SUB_MASTER', 'MASTER'];
    if (!allowedRoles.includes(session.user.role)) {
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
  } catch (error: any) {
    console.error('Manual stock sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Stock sync failed',
      },
      { status: 500 }
    );
  }
}
