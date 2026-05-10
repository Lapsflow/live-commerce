/**
 * GET /api/centers - 센터 목록 조회
 * POST /api/centers - 센터 생성
 * Phase 2: withRole() middleware applied (MASTER, SUB_MASTER)
 */

import { NextRequest } from 'next/server';
import { ok, created, errors } from '@/lib/api/response';
import {
  getCenters,
  createCenter,
  type CreateCenterInput,
} from '@/lib/services/center/centerService';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { validateCenterCode } from '@/lib/validators/center';
import { logAudit } from '@/lib/services/audit';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

/**
 * GET /api/centers
 * 센터 목록 조회 (MASTER, SUB_MASTER 접근 가능)
 * Phase 2: withRole() middleware applied
 */
export const GET = withRole(["MASTER", "SUB_MASTER"], async (req: NextRequest, user) => {
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
 * 센터 생성 (MASTER, SUB_MASTER만 가능)
 * Phase 2: withRole() middleware applied
 */
export const POST = withRole(["MASTER", "SUB_MASTER"], async (req: NextRequest, user) => {
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

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: 'CREATE',
      entityType: 'Center',
      entityId: center.id,
      entityName: center.name,
      after: { code: center.code, name: center.name, regionCode: input.regionCode, regionName: input.regionName },
      description: `센터 생성: ${center.name} (${center.code})`,
      request: req,
    });

    // ── 센터 로그인 계정 동시 생성 (필수) ──
    // 관리자 이름은 센터 대표자 이름을 그대로 사용
    // 연락처는 대표자 연락처를 사용 (별도 입력 받지 않음)
    const adminUsername = (body.adminUsername as string || '').trim();
    const adminPassword = (body.adminPassword as string || '').trim();
    const adminName = (body.adminName as string || body.representative as string || '').trim();
    const adminPhone = (body.adminPhone as string || body.representativePhone as string || '').trim();
    const adminEmail = (body.adminEmail as string || '').trim();

    // Validation - 아이디/비밀번호는 필수
    if (!adminUsername || adminUsername.length < 3) {
      return errors.badRequest('센터 로그인 아이디는 3자 이상이어야 합니다');
    }
    if (!adminPassword || adminPassword.length < 8) {
      return errors.badRequest('센터 로그인 비밀번호는 8자 이상이어야 합니다');
    }
    if (!adminName || adminName.length < 2) {
      return errors.badRequest('관리자 이름이 필요합니다 (대표자 이름 자동 사용)');
    }

    // Username 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { username: adminUsername },
    });
    if (existingUser) {
      return errors.badRequest(`아이디 "${adminUsername}"는 이미 사용 중입니다`);
    }

    // SUB_MASTER 계정 생성
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash,
        name: adminName,
        email: adminEmail || null,
        phone: adminPhone || '',
        role: 'SUB_MASTER',
        centerId: center.id,
        isActive: true,
        contractStatus: 'APPROVED',
        mustChangePassword: true,
      },
    });

    const adminInfo = {
      username: adminUsername,
      temporaryPassword: adminPassword,
      name: adminName,
    };

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: 'CREATE',
      entityType: 'User',
      entityId: adminUser.id,
      entityName: adminUser.name,
      after: { username: adminUsername, role: 'SUB_MASTER', centerId: center.id },
      description: `센터 로그인 계정 생성: ${adminName} (${adminUsername}) → ${center.name}`,
      request: req,
    });

    return created({
      center,
      admin: adminInfo,
      message: '센터 및 로그인 계정이 생성되었습니다',
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
