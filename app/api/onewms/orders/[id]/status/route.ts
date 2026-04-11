/**
 * GET /api/onewms/orders/[id]/status
 * Check order synchronization status with ONEWMS
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getOrderSyncStatus } from '@/lib/services/onewms/orderSync';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get sync status
    const status = await getOrderSyncStatus(orderId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Order status API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
