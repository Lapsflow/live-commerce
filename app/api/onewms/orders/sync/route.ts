/**
 * POST /api/onewms/orders/sync
 * Manual trigger to sync an order to ONEWMS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncOrderToOnewms } from '@/lib/services/onewms/orderSync';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, SUB_MASTER, or MASTER can sync orders
    const allowedRoles = ['ADMIN', 'SUB_MASTER', 'MASTER'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Sync order to ONEWMS
    const result = await syncOrderToOnewms(orderId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order successfully synced to ONEWMS',
      onewmsOrderNo: result.onewmsOrderNo,
    });
  } catch (error: any) {
    console.error('Order sync API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
