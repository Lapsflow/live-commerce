/**
 * POST /api/onewms/products/import
 * Import products from ONEWMS and optionally sync stock
 * Auth: MASTER only
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
  syncStock: z.boolean().optional().default(true),
});

export const POST = withRole(['MASTER'], async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const validation = importSchema.safeParse(body);

    if (!validation.success) {
      return errors.badRequest('유효하지 않은 요청', validation.error.format());
    }

    const { syncStock } = validation.data;

    console.log('Starting ONEWMS product import...');
    const productResult = await importProductsFromOnewms();

    let stockResult = null;
    if (syncStock) {
      console.log('Starting stock sync...');
      stockResult = await syncStockFromOnewms();
    }

    return ok({
      message: 'ONEWMS product import completed',
      products: {
        total: productResult.total,
        created: productResult.created,
        updated: productResult.updated,
        errors: productResult.errors,
        duplicateBarcodes: productResult.duplicateBarcodes,
        errorDetails: productResult.errorDetails.slice(0, 20),
      },
      stock: stockResult
        ? {
            total: stockResult.total,
            synced: stockResult.synced,
            errors: stockResult.errors,
            errorDetails: stockResult.errorDetails.slice(0, 20),
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
