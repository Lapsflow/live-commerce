/**
 * POST /api/onewms/products/import
 * Import products from ONEWMS (batch mode for Vercel 10s limit)
 * Auth: MASTER only
 *
 * Body: { page?: number, limit?: number, syncStock?: boolean, stockOffset?: number, stockLimit?: number }
 * - page: ONEWMS product page (default 1, 100 per page)
 * - syncStock: also sync stock in this call (default false)
 * - stockOffset/stockLimit: stock sync batch position
 *
 * Call repeatedly with incrementing page until hasMore=false.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import {
  importProductsFromOnewms,
  syncStockFromOnewms,
} from '@/lib/services/onewms/productImport';
import { ok, errors } from '@/lib/api/response';

const importSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(10).max(500).optional().default(100),
  syncStock: z.boolean().optional().default(false),
  stockOffset: z.number().int().min(0).optional().default(0),
  stockLimit: z.number().int().min(1).max(50).optional().default(20),
});

export const POST = withRole(['MASTER'], async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const validation = importSchema.safeParse(body);

    if (!validation.success) {
      return errors.badRequest('유효하지 않은 요청', validation.error.format());
    }

    const { page, limit, syncStock, stockOffset, stockLimit } = validation.data;

    console.log(`ONEWMS product import: page=${page}, limit=${limit}, syncStock=${syncStock}`);
    const productResult = await importProductsFromOnewms(page, limit);

    let stockResult = null;
    if (syncStock) {
      stockResult = await syncStockFromOnewms(stockOffset, stockLimit);
    }

    return ok({
      message: 'ONEWMS product import batch completed',
      products: {
        total: productResult.total,
        created: productResult.created,
        updated: productResult.updated,
        errors: productResult.errors,
        duplicateBarcodes: productResult.duplicateBarcodes,
        page: productResult.page,
        hasMore: productResult.hasMore,
        errorDetails: productResult.errorDetails.slice(0, 10),
      },
      stock: stockResult
        ? {
            total: stockResult.total,
            synced: stockResult.synced,
            errors: stockResult.errors,
            offset: stockResult.offset,
            hasMore: stockResult.hasMore,
            errorDetails: stockResult.errorDetails.slice(0, 10),
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Product import API error:', error);
    const message = error instanceof Error ? error.message : 'Product import failed';
    return errors.internal(message);
  }
});
