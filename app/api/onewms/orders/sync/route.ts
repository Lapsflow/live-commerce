/**
 * POST /api/onewms/orders/sync
 * Manual trigger to sync an order to ONEWMS
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { syncOrderToOnewms } from '@/lib/services/onewms/orderSync';
import { ok, errors } from '@/lib/api/response';

const orderSyncSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
});

export const POST = withRole(
  ['ADMIN', 'SUB_MASTER', 'MASTER'],
  async (req: NextRequest) => {
    try {
      // Parse and validate request body
      const body = await req.json();
      const validation = orderSyncSchema.safeParse(body);

      if (!validation.success) {
        return errors.badRequest(
          '유효하지 않은 요청',
          validation.error.format()
        );
      }

      const { orderId } = validation.data;

      // Sync order to ONEWMS
      const result = await syncOrderToOnewms(orderId);

      if (!result.success) {
        return errors.badRequest(result.error || 'Order sync failed');
      }

      return ok({
        message: 'Order successfully synced to ONEWMS',
        onewmsOrderNo: result.onewmsOrderNo,
      });
    } catch (error) {
      console.error('Order sync API error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errors.internal(message);
    }
  }
);
