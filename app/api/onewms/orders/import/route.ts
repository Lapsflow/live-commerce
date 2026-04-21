/**
 * POST /api/onewms/orders/import
 * Import orders from ONEWMS into the platform
 * Auth: MASTER only
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { importOrdersFromOnewms } from '@/lib/services/onewms/orderImport';
import { ok, errors } from '@/lib/api/response';

const importSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
  sub_domain_seq: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(10).max(500).optional().default(50),
});

export const POST = withRole(['MASTER'], async (req: NextRequest) => {
  try {
    const body = await req.json();
    const validation = importSchema.safeParse(body);

    if (!validation.success) {
      return errors.badRequest('유효하지 않은 요청', validation.error.format());
    }

    const { start_date, end_date, sub_domain_seq, page, limit } = validation.data;

    console.log(`Starting ONEWMS order import: ${start_date} ~ ${end_date}, page=${page}, limit=${limit}`);
    const result = await importOrdersFromOnewms({
      start_date,
      end_date,
      sub_domain_seq,
      page,
      limit,
    });

    return ok({
      message: 'ONEWMS order import batch completed',
      orders: {
        total: result.total,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
        productsAutoCreated: result.productsAutoCreated,
        page: result.page,
        hasMore: result.hasMore,
        errorDetails: result.errorDetails.slice(0, 20),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Order import API error:', error);
    const message = error instanceof Error ? error.message : 'Order import failed';
    return errors.internal(message);
  }
});
