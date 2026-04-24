/**
 * POST /api/pricing/search
 * Search products on Naver marketplace
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
    const { query, limit } = body;

    if (!query || typeof query !== 'string') {
      return errors.badRequest('query 필드가 필요합니다');
    }

    if (query.trim().length < 2) {
      return errors.badRequest('검색어는 2자 이상이어야 합니다');
    }

    // Validate limit if provided
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
      return errors.badRequest('limit은 1-100 사이의 숫자여야 합니다');
    }

    const results = await searchProducts(query, {
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
