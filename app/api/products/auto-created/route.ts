/**
 * GET /api/products/auto-created
 * 자동 등록 상품 목록 조회 (MASTER/SUB_MASTER 전용)
 * Query: ?reviewed=false (미검토만) | ?reviewed=true (검토완료) | 없으면 전체
 */

import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { paginated } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const GET = withRole(
  ['MASTER', 'SUB_MASTER'],
  async (req: NextRequest, _user: AuthUser) => {
    const { searchParams } = new URL(req.url);
    const reviewed = searchParams.get('reviewed');
    // 2026-07-10 수정: DataTable(use-api-crud)은 pageIndex(0-base)/pageSize 를 보내는데
    // 기존엔 page(1-base)/limit 만 읽어 페이지당·페이지 이동이 전부 무시됐음.
    // pageIndex/pageSize 우선, 구 page/limit 호환 유지.
    const pageIndexParam = searchParams.get('pageIndex');
    const pageSizeParam = searchParams.get('pageSize');
    const page = pageIndexParam !== null
      ? Math.max(0, parseInt(pageIndexParam, 10)) + 1
      : Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(pageSizeParam ?? searchParams.get('limit') ?? '20', 10))
    );

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

    // 2026-07-10 수정: ok({data,...}) 는 {data:{data,...}} 로 중첩되어
    // use-api-crud 가 json.data 를 배열로 읽지 못했음 → 표준 paginated() 사용.
    return paginated(data, totalCount, limit);
  }
);
