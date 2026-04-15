/**
 * POST /api/broadcasts/lookup-center
 * Lookup center information by code for broadcast start (SELLER accessible)
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return errors.badRequest('code 필드가 필요합니다');
    }

    // Lookup center by code
    const center = await prisma.center.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        regionCode: true,
        regionName: true,
        isActive: true,
        _count: {
          select: {
            centerStocks: true,
            users: true,
            broadcasts: true,
          },
        },
      },
    });

    if (!center) {
      return errors.notFound('센터를 찾을 수 없습니다');
    }

    if (!center.isActive) {
      return errors.badRequest('비활성화된 센터입니다');
    }

    return ok({
      id: center.id,
      code: center.code,
      name: center.name,
      regionName: center.regionName,
      productCount: center._count.centerStocks,
    });
  } catch (error) {
    console.error('[Broadcast] Failed to lookup center:', error);

    if (error instanceof Error) {
      return errors.internal(error.message);
    }

    return errors.internal('센터 조회 중 오류가 발생했습니다');
  }
}
