/**
 * GET /api/pricing/compare
 * Compare prices across marketplaces for a given barcode
 * Phase 2: withRole() middleware applied
 */

import { NextRequest } from 'next/server';
import { ok, errors } from '@/lib/api/response';
import { getPricing } from '@/lib/services/pricing/marketPricing';
import { withRole, type AuthUser } from '@/lib/api/middleware';

export const GET = withRole(["ADMIN", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  try {

    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode');
    const ourPriceStr = searchParams.get('price');
    const skipCache = searchParams.get('skipCache') === 'true';

    if (!barcode) {
      return errors.badRequest('barcode 파라미터가 필요합니다');
    }

    // Parse our price if provided
    const ourPrice = ourPriceStr ? parseInt(ourPriceStr) : undefined;

    if (ourPriceStr && (isNaN(ourPrice!) || ourPrice! <= 0)) {
      return errors.badRequest('price는 양수여야 합니다');
    }

    // Get pricing data
    const pricing = await getPricing(barcode, {
      ourPrice,
      skipCache,
      storeInDb: true,
    });

    return ok(pricing);
  } catch (error) {
    console.error('Failed to compare prices:', error);
    const message =
      error instanceof Error ? error.message : '가격 비교 중 오류가 발생했습니다';
    return errors.internal(message);
  }
});
