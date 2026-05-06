/**
 * GET /api/products/auto-created
 * 자동 등록 상품 목록 조회 (MASTER/SUB_MASTER 전용)
 * Query: ?reviewed=false (미검토만) | ?reviewed=true (검토완료) | 없으면 전체
 */

import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const GET = withRole(
  ['MASTER', 'SUB_MASTER'],
  async (req: NextRequest, _user: AuthUser) => {
    const { searchParams } = new URL(req.url);
    const reviewed = searchParams.get('reviewed');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {
      autoCreated: true,
    };

    if (reviewed === 'false') {
      where.reviewedAt = null;
    } else if (reviewed === 'true') {
      where.reviewedAt = { not: null };
    }

    const [data, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          barcode: true,
          sellPrice: true,
          supplyPrice: true,
          originalPrice: true,
          totalStock: true,
          onewmsCode: true,
          isActive: true,
          autoCreatedAt: true,
          reviewedAt: true,
          reviewedBy: true,
          createdAt: true,
        },
        orderBy: { autoCreatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return ok({
      data,
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
    });
  }
);
