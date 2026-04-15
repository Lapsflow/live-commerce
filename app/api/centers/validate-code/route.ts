// app/api/centers/validate-code/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { validateCenterCode } from '@/lib/services/center/centerService';
import { getCenterByCode } from '@/lib/services/center/centerService';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth();
    if (!session) return errors.unauthorized();

    // 2. Authorization (MASTER only for validation)
    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 코드 검증 권한이 없습니다');
    }

    // 3. Parse request body
    const body = await req.json();
    if (!body.code) {
      return errors.badRequest('code 필드가 필요합니다');
    }

    // 4. Validate center code
    const validation = await validateCenterCode(body.code);

    // 5. If code exists, fetch full center details
    if (validation.valid && !validation.available) {
      const center = await getCenterByCode(body.code);
      return ok({
        ...validation,
        center,
      });
    }

    return ok(validation);
  } catch (error) {
    console.error('Failed to validate center code:', error);
    const message = error instanceof Error ? error.message : 'Failed to validate center code';
    return errors.internal(message);
  }
}
