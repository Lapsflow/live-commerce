// app/api/centers/check-available/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { getCenterByCode } from '@/lib/services/center/centerService';

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth();
    if (!session) return errors.unauthorized();

    // 2. Authorization (MASTER, SUB_MASTER, ADMIN allowed)
    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 코드 조회 권한이 없습니다');
    }

    // 3. Parse query parameter
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return errors.badRequest('code 쿼리 파라미터가 필요합니다');
    }

    // 4. Check if code exists
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
