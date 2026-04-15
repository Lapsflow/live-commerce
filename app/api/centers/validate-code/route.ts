/**
 * POST /api/centers/validate-code - 센터코드 유효성 검증
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { validateCenterCode } from '@/lib/services/center/centerService';

/**
 * POST /api/centers/validate-code
 * 센터코드 형식 및 사용 가능 여부 검증
 *
 * @param body { code: string } - 검증할 센터코드 (예: "01-4213")
 * @returns { valid: boolean, available: boolean, message: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    // MASTER만 센터코드 검증 가능
    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 코드 검증 권한이 없습니다');
    }

    const body = await req.json();

    if (!body.code) {
      return errors.badRequest('code 필드가 필요합니다');
    }

    const result = await validateCenterCode(body.code);

    return ok(result);
  } catch (error) {
    console.error('Failed to validate center code:', error);
    const message = error instanceof Error ? error.message : 'Failed to validate center code';
    return errors.internal(message);
  }
}
