/**
 * POST /api/onewms/orders/retry
 * Manually retry failed order synchronizations
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { retryFailedOrders } from '@/lib/services/onewms/orderSync';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, SUB_MASTER, or MASTER can retry orders
    const allowedRoles = ['ADMIN', 'SUB_MASTER', 'MASTER'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Retry failed orders
    const result = await retryFailedOrders();

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} failed orders`,
      statistics: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    console.error('Order retry API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
