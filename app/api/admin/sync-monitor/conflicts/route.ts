/**
 * GET /api/admin/sync-monitor/conflicts — 활성 충돌 목록 (커서 페이지네이션, MASTER 전용)
 *
 * 성능 개선 (2026-07-10, docs/PERFORMANCE_DIAGNOSIS_20260710.md 옵션 A):
 *   기존 getStockConflicts() 는 전체 conflict 를 무제한 반환 + productName 조인
 *   (CLAUDE.md 학습 #10 — 13k+ row 반환 시 브라우저 OOM crash).
 *   → limit 기본 20 / 최대 100 강제 + 커서 기반 페이지네이션 (CLAUDE.md 학습 #10 원칙).
 *   productName 은 현재 페이지 분량만 배치 조회.
 */

import { NextRequest } from 'next/server';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const maxDuration = 30;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = withRole(['MASTER'], async (req: NextRequest, _user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Number.isNaN(limitParam) ? DEFAULT_LIMIT : Math.max(limitParam, 1), MAX_LIMIT);
  const cursor = searchParams.get('cursor');

  // 매번 전체 조회 대신 커서 기반 페이지네이션 (take + 1 로 hasMore 판정)
  const conflicts = await prisma.onewmsStockSync.findMany({
    where: { syncStatus: 'conflict' },
    orderBy: [{ syncedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      productId: true,
      productCode: true,
      availableQty: true,
      localQty: true,
      difference: true,
      syncedAt: true,
    },
  });

  const hasMore = conflicts.length > limit;
  const items = hasMore ? conflicts.slice(0, limit) : conflicts;

  // productName 은 현재 페이지 분량만 배치로 한 번에 조회
  const productIds = Array.from(new Set(items.map((c) => c.productId)));
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameMap = new Map(products.map((p) => [p.id, p.name]));

  return ok({
    items: items.map((c) => ({
      id: c.id,
      productId: c.productId,
      productCode: c.productCode,
      productName: nameMap.get(c.productId) ?? 'Unknown',
      onewmsQty: c.availableQty,
      localQty: c.localQty,
      difference: c.difference,
      syncedAt: c.syncedAt.toISOString(),
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});
