/**
 * GET /api/admin/sync-monitor/summary — 요약 카드 + Cron 이력 (MASTER 전용)
 *
 * 성능 개선 (2026-07-10, docs/PERFORMANCE_DIAGNOSIS_20260710.md 옵션 A):
 *   기존 /api/admin/sync-monitor GET 은 getStockConflicts() 전체 조회를 포함한
 *   Promise.all 6쿼리 — 가장 느린 쿼리가 끝날 때까지 응답 전체가 대기하여
 *   페이지 랜딩 실패 (CLAUDE.md 학습 #10 재현 케이스).
 *   → 가벼운 요약만 이 endpoint 로 분리. count 개별 2회 스캔은 GROUP BY 1회로 통합.
 *   기존 endpoint 는 호환성 위해 유지 (신규 3개 안정화 후 deprecate).
 */

import { NextRequest } from 'next/server';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const maxDuration = 30;

export const GET = withRole(['MASTER'], async (_req: NextRequest, _user: AuthUser) => {
  // Run queries with individual error resilience (기존 route.ts 와 동일 패턴)
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[SYNC-MONITOR/SUMMARY] ${label} failed:`, err);
      return fallback;
    }
  };

  const [statusCounts, mappingStatusCounts, cronLogs, lastHealthcheck] = await Promise.all([
    // conflict count — 개별 count 대신 GROUP BY 1회 (단일 테이블 스캔)
    safe(
      'statusCounts',
      () => prisma.$queryRaw<Array<{ status: string; count: number }>>`
        SELECT "syncStatus" as status, COUNT(*)::int as count
        FROM "OnewmsStockSync"
        GROUP BY "syncStatus"
      `,
      []
    ),

    // failed order count — GROUP BY 통합
    safe(
      'mappingStatusCounts',
      () => prisma.$queryRaw<Array<{ status: string; count: number }>>`
        SELECT status, COUNT(*)::int as count
        FROM "OnewmsOrderMapping"
        GROUP BY status
      `,
      []
    ),

    // Cron 실행 이력 (최근 10회) — 인덱스 OK, 가벼움
    safe(
      'cronLogs',
      () =>
        prisma.auditLog.findMany({
          where: { entityId: 'cron-stock-sync', ipAddress: 'cron' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, createdAt: true, description: true, metadata: true },
        }),
      []
    ),

    safe(
      'lastHealthcheck',
      () =>
        prisma.auditLog.findFirst({
          where: { entityId: 'healthcheck' },
          orderBy: { createdAt: 'desc' },
          select: { metadata: true, createdAt: true },
        }),
      null
    ),
  ]);

  const conflictCount = statusCounts.find((s) => s.status === 'conflict')?.count ?? 0;
  const failedOrders = mappingStatusCounts.find((s) => s.status === 'failed')?.count ?? 0;

  const lastSync = cronLogs[0] || null;
  const lastSyncMeta = lastSync?.metadata as Record<string, unknown> | null;
  const healthcheckMeta = lastHealthcheck?.metadata as Record<string, unknown> | null;

  return ok({
    summary: {
      lastSyncTime: lastSync?.createdAt?.toISOString() ?? null,
      lastSyncDuration: (lastSyncMeta?.durationMs as number) ?? null,
      matchRate: (healthcheckMeta?.matchRate as number) ?? null,
      lastHealthcheckTime: lastHealthcheck?.createdAt?.toISOString() ?? null,
      activeConflicts: conflictCount,
      failedOrders,
    },
    cronHistory: cronLogs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      description: log.description,
      metadata: log.metadata,
    })),
  });
});
