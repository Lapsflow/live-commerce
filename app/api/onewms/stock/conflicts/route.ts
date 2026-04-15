/**
 * GET /api/onewms/stock/conflicts
 * List all unresolved stock conflicts
 */

import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { getStockConflicts } from '@/lib/services/onewms/stockSync';
import { ok, errors } from '@/lib/api/response';

export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'ADMIN'],
  async (req: NextRequest) => {
    try {
      // Get all conflicts
      const conflicts = await getStockConflicts();

      return ok({
        conflicts,
        count: conflicts.length,
      });
    } catch (error) {
      console.error('Failed to fetch stock conflicts:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch conflicts';
      return errors.internal(message);
    }
  }
);
