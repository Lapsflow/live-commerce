/**
 * GET /api/admin/sync-monitor/trend — 충돌 추이 7일 (MASTER 전용)
 *
 * 성능 개선 (2026-07-10, docs/PERFORMANCE_DIAGNOSIS_20260710.md 옵션 A):
 *   기존 통합 endpoint 의 Promise.all 에서 분리 — 요약 카드보다 늦게 와도
 *   프론트에서 개별 스켈레톤으로 부분 렌더 가능.
 */

import { NextRequest } from 'next/server';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const maxDuration = 30;

export const GET = withRole(['MASTER'], async (_req: NextRequest, _user: AuthUser) => {
  let trend: Array<{ date: string; count: number }> = [];
  try {
    trend = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT TO_CHAR("syncedAt"::date, 'YYYY-MM-DD') as date,
             COUNT(*)::int as count
      FROM "OnewmsStockSync"
      WHERE "syncStatus" = 'conflict'
        AND "syncedAt" >= NOW() - INTERVAL '7 days'
      GROUP BY "syncedAt"::date
      ORDER BY "syncedAt"::date
    `;
  } catch (err) {
    console.error('[SYNC-MONITOR/TREND] query failed:', err);
  }

  return ok({ trend });
});
