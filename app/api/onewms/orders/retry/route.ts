/**
 * POST /api/onewms/orders/retry
 * Manually retry failed order synchronizations
 */

import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { retryFailedOrders } from '@/lib/services/onewms/orderSync';
import { ok, errors } from '@/lib/api/response';

export const POST = withRole(
  ['ADMIN', 'SUB_MASTER', 'MASTER'],
  async (req: NextRequest) => {
    try {
      // Retry failed orders
      const result = await retryFailedOrders();

      return ok({
        message: `Processed ${result.processed} failed orders`,
        statistics: {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      console.error('Order retry API error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errors.internal(message);
    }
  }
);
