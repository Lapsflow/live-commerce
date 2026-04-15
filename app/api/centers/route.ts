/**
 * GET /api/centers - 센터 목록 조회
 * POST /api/centers - 센터 생성
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import {
  getCenters,
  createCenter,
  type CreateCenterInput,
} from '@/lib/services/center/centerService';

/**
 * GET /api/centers
 * 센터 목록 조회 (MASTER, SUB_MASTER, ADMIN만 접근 가능)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    // Only MASTER, SUB_MASTER, ADMIN can view all centers
    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return errors.forbidden('센터 목록 조회 권한이 없습니다');
    }

    // Query parameters
    const { searchParams } = new URL(req.url);
    const regionCode = searchParams.get('regionCode') || undefined;
    const isActive = searchParams.get('isActive');
    const includeStats = searchParams.get('includeStats') === 'true';

    const centers = await getCenters({
      regionCode,
      isActive: isActive ? isActive === 'true' : undefined,
      includeStats,
    });

    return ok({
      centers,
      count: centers.length,
    });
  } catch (error) {
    console.error('Failed to get centers:', error);
    const message = error instanceof Error ? error.message : 'Failed to get centers';
    return errors.internal(message);
  }
}

/**
 * POST /api/centers
 * 센터 생성 (MASTER만 가능)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    // Only MASTER can create centers
    if (session.user?.role !== 'MASTER') {
      return errors.forbidden('센터 생성 권한이 없습니다. MASTER 권한이 필요합니다.');
    }

    const body = await req.json();

    // Validate required fields
    const requiredFields = [
      'code',
      'name',
      'regionCode',
      'regionName',
      'representative',
      'representativePhone',
      'address',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return errors.badRequest(`${field} is required`);
      }
    }

    const input: CreateCenterInput = {
      code: body.code,
      name: body.name,
      regionCode: body.regionCode,
      regionName: body.regionName,
      representative: body.representative,
      representativePhone: body.representativePhone,
      address: body.address,
      addressDetail: body.addressDetail,
      businessNo: body.businessNo,
      contractDate: body.contractDate ? new Date(body.contractDate) : undefined,
      contractDocument: body.contractDocument,
    };

    const center = await createCenter(input);

    return ok(
      {
        center,
        message: '센터가 성공적으로 생성되었습니다',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create center:', error);
    const message = error instanceof Error ? error.message : 'Failed to create center';

    // Handle duplicate code error
    if (message.includes('already exists')) {
      return errors.badRequest(message);
    }

    return errors.internal(message);
  }
}
