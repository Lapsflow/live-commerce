/**
 * POST /api/onewms/stock/sync
 * Manual trigger for stock synchronization
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { syncAllStocks, syncProductStock } from '@/lib/services/onewms/stockSync';
import { ok, errors } from '@/lib/api/response';

const stockSyncSchema = z.object({
  productId: z.string().optional(),
});

export const POST = withRole(
  ['ADMIN', 'SUB_MASTER', 'MASTER'],
  async (req: NextRequest) => {
    try {
      // Parse and validate request body
      const body = await req.json().catch(() => ({}));
      const validation = stockSyncSchema.safeParse(body);

      if (!validation.success) {
        return errors.badRequest(
          '유효하지 않은 요청',
          validation.error.format()
        );
      }

      const { productId } = validation.data;

      if (productId) {
        // Single product sync
        console.log('Manual stock sync triggered for product:', productId);

        const result = await syncProductStock(productId);

        if (!result.success) {
          return errors.badRequest(result.error || 'Stock sync failed');
        }

        return ok({
          message: result.conflict
            ? 'Stock sync completed with conflict detected'
            : 'Stock sync completed successfully',
          productId,
          conflict: result.conflict,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Full sync for all products
        console.log('Manual stock sync triggered for all products');

        const stats = await syncAllStocks();

        return ok({
          message: 'Stock sync completed successfully',
          stats,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Manual stock sync failed:', error);
      const message = error instanceof Error ? error.message : 'Stock sync failed';
      return errors.internal(message);
    }
  }
);
