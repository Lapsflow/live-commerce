/**
 * GET /api/sellers/[id]/recommended-products
 * Get recommended products for a seller based on RFM scores
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { getRecommendedProducts } from '@/lib/services/analytics/sellerProductMatching';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }

    const sellerId = params.id;
    const { searchParams } = new URL(req.url);

    // Query parameters
    const minScore = searchParams.get('minScore');
    const limit = searchParams.get('limit');

    // Verify user is the seller or has admin rights
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    if (sellerId !== userId && !['MASTER', 'SUB_MASTER', 'ADMIN'].includes(userRole)) {
      return errors.forbidden('해당 셀러의 추천 상품을 조회할 권한이 없습니다');
    }

    // Get recommended products
    const recommendations = await getRecommendedProducts(sellerId, {
      minScore: minScore ? parseInt(minScore, 10) : 50,
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return ok({
      sellerId,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error('[Recommended Products] Failed to get recommendations:', error);

    if (error instanceof Error) {
      return errors.internal(error.message);
    }

    return errors.internal('추천 상품 조회 중 오류가 발생했습니다');
  }
}
