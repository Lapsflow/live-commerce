/**
 * GET /api/centers/[id]/users - 센터 소속 사용자 조회
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/centers/[id]/users
 * 센터에 소속된 사용자 목록 조회
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
      return errors.forbidden('센터 사용자 조회 권한이 없습니다');
    }

    // Verify center exists
    const center = await prisma.center.findUnique({
      where: { id: params.id },
    });

    if (!center) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    // Query parameters
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role'); // Filter by role

    // Get users
    const users = await prisma.user.findMany({
      where: {
        centerId: params.id,
        ...(role ? { role: role as any } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        channels: true,
        avgSales: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return ok({
      center: {
        id: center.id,
        code: center.code,
        name: center.name,
      },
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Failed to get center users:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to get center users';
    return errors.internal(message);
  }
}
