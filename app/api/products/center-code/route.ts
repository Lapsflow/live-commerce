import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { ok, errors } from '@/lib/api/response';
import { previewCenterProductCode } from '@/lib/services/products/codeGenerator';

/**
 * GET /api/products/center-code?centerId=xxx
 * 센터 상품 코드 미리보기 (다음 번호 조회)
 */
export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'ADMIN'],
  async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const centerId = searchParams.get('centerId');

    if (!centerId) {
      return errors.badRequest('centerId가 필요합니다');
    }

    // SUB_MASTER/ADMIN은 본인 센터만
    if (
      (user.role === 'SUB_MASTER' || user.role === 'ADMIN') &&
      user.centerId !== centerId
    ) {
      return errors.forbidden('본인 센터의 상품 코드만 조회할 수 있습니다');
    }

    try {
      const code = await previewCenterProductCode(centerId);
      return ok({ code });
    } catch (err) {
      const message = err instanceof Error ? err.message : '코드 생성 실패';
      return errors.badRequest(message);
    }
  }
);
