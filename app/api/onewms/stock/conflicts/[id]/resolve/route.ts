/**
 * POST /api/onewms/stock/conflicts/[id]/resolve
 * Resolve a stock conflict
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { resolveConflict } from '@/lib/services/onewms/stockSync';
import { ok, errors } from '@/lib/api/response';

const resolveConflictSchema = z.object({
  resolution: z.enum(['onewms', 'local', 'ignore'], {
    errorMap: () => ({ message: 'resolution must be: onewms, local, or ignore' }),
  }),
});

export const POST = withRole(
  ['ADMIN', 'SUB_MASTER', 'MASTER'],
  async (
    req: NextRequest,
    user,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      // Parse and validate request body
      const body = await req.json();
      const validation = resolveConflictSchema.safeParse(body);

      if (!validation.success) {
        return errors.badRequest(
          '유효하지 않은 요청',
          validation.error.format()
        );
      }

      const { resolution } = validation.data;

      // Resolve conflict
      const result = await resolveConflict(id, resolution);

      if (!result.success) {
        return errors.badRequest(result.error || 'Conflict resolution failed');
      }

      return ok({
        message: 'Conflict resolved successfully',
      });
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      const message = error instanceof Error ? error.message : 'Failed to resolve conflict';
      return errors.internal(message);
    }
  }
);
