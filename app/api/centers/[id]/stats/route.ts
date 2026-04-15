/**
 * GET /api/centers/[id]/stats - 센터 통계 조회
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { getCenterStats } from '@/lib/services/center/centerService';

/**
 * GET /api/centers/[id]/stats
 * 센터 통계 조회 (센터별 매출, 재고, 사용자 수 등)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const { id } = await params;

    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 통계 조회 권한이 없습니다');
    }

    const result = await getCenterStats(id);

    return ok(result);
  } catch (error) {
    console.error('Failed to get center stats:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get center stats';

    if (message.includes('not found')) {
      return errors.notFound(message);
    }

    return errors.internal(message);
  }
}
