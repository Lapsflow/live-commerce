/**
 * GET /api/centers - 센터 목록 조회
 * POST /api/centers - 센터 생성
 * Phase 2: withRole() middleware applied (ADMIN only for now)
 */

import { NextRequest } from 'next/server';
import { ok, created, errors } from '@/lib/api/response';
import {
  getCenters,
  createCenter,
  type CreateCenterInput,
} from '@/lib/services/center/centerService';
import { withRole } from '@/lib/api/middleware';
import { validateCenterCode } from '@/lib/validators/center';

/**
 * GET /api/centers
 * 센터 목록 조회 (ADMIN만 접근 가능)
 * Phase 2: withRole() middleware applied
 */
export const GET = withRole(["ADMIN"], async (req: NextRequest, user) => {
  try {

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
});

/**
 * POST /api/centers
 * 센터 생성 (ADMIN만 가능)
 * Phase 2: withRole() middleware applied
 */
export const POST = withRole(["ADMIN"], async (req: NextRequest, user) => {
  try {

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

    // pptx 스펙: 센터 코드 형식 검증
    if (!validateCenterCode(body.code)) {
      return errors.badRequest(
        '센터 코드 형식이 올바르지 않습니다. 형식: [01-17]-[4자리 숫자] (예: 01-4213)'
      );
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

    return created({
      center,
      message: '센터가 성공적으로 생성되었습니다',
    });
  } catch (error) {
    console.error('Failed to create center:', error);
    const message = error instanceof Error ? error.message : 'Failed to create center';

    // Handle duplicate code error
    if (message.includes('already exists')) {
      return errors.badRequest(message);
    }

    return errors.internal(message);
  }
});
