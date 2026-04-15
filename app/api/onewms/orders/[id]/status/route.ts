/**
 * GET /api/onewms/orders/[id]/status
 * Check order synchronization status with ONEWMS
 */

import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { getOrderSyncStatus } from '@/lib/services/onewms/orderSync';
import { ok, errors } from '@/lib/api/response';

export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'ADMIN', 'SELLER'],
  async (
    req: NextRequest,
    user,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: orderId } = await params;

      if (!orderId) {
        return errors.badRequest('Order ID is required');
      }

      // Get sync status
      const status = await getOrderSyncStatus(orderId);

      return ok(status);
    } catch (error) {
      console.error('Order status API error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errors.internal(message);
    }
  }
);
