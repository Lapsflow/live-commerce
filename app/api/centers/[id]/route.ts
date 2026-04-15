/**
 * GET /api/centers/[id] - 센터 상세 조회
 * PUT /api/centers/[id] - 센터 수정
 * DELETE /api/centers/[id] - 센터 삭제
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import {
  getCenterById,
  updateCenter,
  deactivateCenter,
  type UpdateCenterInput,
} from '@/lib/services/center/centerService';

/**
 * GET /api/centers/[id]
 * 센터 상세 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 조회 권한이 없습니다');
    }

    const { searchParams } = new URL(req.url);
    const includeStats = searchParams.get('includeStats') === 'true';

    const center = await getCenterById(params.id, includeStats);

    if (!center) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    return ok({ center });
  } catch (error) {
    console.error('Failed to get center:', error);
    const message = error instanceof Error ? error.message : 'Failed to get center';
    return errors.internal(message);
  }
}

/**
 * PUT /api/centers/[id]
 * 센터 수정 (MASTER만 가능)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 수정 권한이 없습니다. MASTER 권한이 필요합니다.');
    }

    const body = await req.json();

    const input: UpdateCenterInput = {
      name: body.name,
      representative: body.representative,
      representativePhone: body.representativePhone,
      address: body.address,
      addressDetail: body.addressDetail,
      businessNo: body.businessNo,
      contractDate: body.contractDate ? new Date(body.contractDate) : undefined,
      contractDocument: body.contractDocument,
      isActive: body.isActive,
    };

    // Remove undefined values
    Object.keys(input).forEach(
      (key) =>
        input[key as keyof UpdateCenterInput] === undefined &&
        delete input[key as keyof UpdateCenterInput]
    );

    const center = await updateCenter(params.id, input);

    return ok({
      center,
      message: '센터 정보가 업데이트되었습니다',
    });
  } catch (error) {
    console.error('Failed to update center:', error);
    const message = error instanceof Error ? error.message : 'Failed to update center';

    if (message.includes('not found')) {
      return errors.notFound(message);
    }

    return errors.internal(message);
  }
}

/**
 * DELETE /api/centers/[id]
 * 센터 비활성화 (소프트 삭제)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 삭제 권한이 없습니다. MASTER 권한이 필요합니다.');
    }

    const center = await deactivateCenter(params.id);

    return ok({
      center,
      message: '센터가 비활성화되었습니다',
    });
  } catch (error) {
    console.error('Failed to deactivate center:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to deactivate center';

    if (message.includes('not found')) {
      return errors.notFound(message);
    }

    return errors.internal(message);
  }
}
