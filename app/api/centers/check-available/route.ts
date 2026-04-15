/**
 * GET /api/centers/check-available - 센터코드 사용 가능 여부 조회
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { getCenterByCode } from '@/lib/services/center/centerService';

/**
 * GET /api/centers/check-available?code={code}
 * 센터코드 사용 가능 여부 조회 (중복 확인)
 *
 * @param searchParams { code: string } - 확인할 센터코드 (예: "01-4213")
 * @returns { code: string, available: boolean, exists: boolean }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 코드 조회 권한이 없습니다');
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return errors.badRequest('code 쿼리 파라미터가 필요합니다');
    }

    const existing = await getCenterByCode(code);

    return ok({
      code,
      available: !existing,
      exists: !!existing,
    });
  } catch (error) {
    console.error('Failed to check code availability:', error);
    const message = error instanceof Error ? error.message : 'Failed to check code availability';
    return errors.internal(message);
  }
}
