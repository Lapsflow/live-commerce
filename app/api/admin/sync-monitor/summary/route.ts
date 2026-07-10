/**
 * GET /api/admin/sync-monitor/summary — 요약 카드 + Cron 이력 (MASTER 전용)
 *
 * 성능 개선 (2026-07-10, docs/PERFORMANCE_DIAGNOSIS_20260710.md 옵션 A):
 *   기존 /api/admin/sync-monitor GET 은 getStockConflicts() 전체 조회를 포함한
 *   Promise.all 6쿼리 — 가장 느린 쿼리가 끝날 때까지 응답 전체가 대기하여
 *   페이지 랜딩 실패 (CLAUDE.md 학습 #10 재현 케이스).
 *   → 가벼운 요약만 이 endpoint 로 분리.
 *   기존 endpoint 는 호환성 위해 유지 (신규 3개 안정화 후 deprecate).
 *
 * 2차 수정 (2026-07-10 §11.2): OnewmsStockSync 는 55.9M 행 — GROUP BY 는
 *   여전히 풀스캔 (EXPLAIN: Parallel Seq Scan). syncStatus 필터가 인덱스
 *   (syncStatus, syncedAt DESC) 를 타도록 조건 count 로 변경.
 *   ⚠️ 이 테이블에 무조건(WHERE 없는) count/GROUP BY 금지.
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

  const [conflictCount, failedOrders, cronLogs, lastHealthcheck] = await Promise.all([
    // conflict count — (syncStatus, syncedAt) 인덱스 range scan (conflict 행은 극소수)
    safe(
      'conflictCount',
      () => prisma.onewmsStockSync.count({ where: { syncStatus: 'conflict' } }),
      0
    ),

    // failed order count — OnewmsOrderMapping 은 소규모 + status 인덱스 존재
    safe(
      'failedOrders',
      () => prisma.onewmsOrderMapping.count({ where: { status: 'failed' } }),
      0
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
