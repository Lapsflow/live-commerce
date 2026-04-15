/**
 * POST /api/pricing/search
 * Search products across marketplaces
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { searchProducts } from '@/lib/services/pricing/marketPricing';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const body = await req.json();
    const { query, marketplaces, limit } = body;

    if (!query || typeof query !== 'string') {
      return errors.badRequest('query 필드가 필요합니다');
    }

    if (query.trim().length < 2) {
      return errors.badRequest('검색어는 2자 이상이어야 합니다');
    }

    // Validate marketplaces if provided
    if (marketplaces && !Array.isArray(marketplaces)) {
      return errors.badRequest('marketplaces는 배열이어야 합니다');
    }

    if (
      marketplaces &&
      !marketplaces.every((m: string) => ['naver', 'coupang'].includes(m))
    ) {
      return errors.badRequest(
        'marketplaces는 "naver" 또는 "coupang"만 포함할 수 있습니다'
      );
    }

    // Validate limit if provided
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
      return errors.badRequest('limit은 1-100 사이의 숫자여야 합니다');
    }

    // Search products
    const results = await searchProducts(query, {
      marketplaces: marketplaces || ['naver', 'coupang'],
      limit: limit || 20,
    });

    return ok(results);
  } catch (error) {
    console.error('Failed to search products:', error);
    const message =
      error instanceof Error ? error.message : '상품 검색 중 오류가 발생했습니다';
    return errors.internal(message);
  }
}
