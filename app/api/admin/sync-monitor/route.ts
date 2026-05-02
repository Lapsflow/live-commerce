/**
 * GET /api/admin/sync-monitor — Dashboard data for sync monitoring (MASTER only)
 * POST /api/admin/sync-monitor — Run on-demand healthcheck (MASTER only)
 */

import { NextRequest } from 'next/server';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getStockConflicts } from '@/lib/services/onewms/stockSync';
import { runHealthcheck } from '@/lib/services/onewms/healthcheck';

export const maxDuration = 60;

// ─── GET: Monitoring dashboard data ───

export const GET = withRole(
  ['MASTER'],
  async (_req: NextRequest, _user: AuthUser) => {
    // Run queries with individual error resilience
    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        console.error(`[SYNC-MONITOR] ${label} failed:`, err);
        return fallback;
      }
    };

    const [cronLogs, conflictCount, failedOrderCount, conflicts, conflictTrend, lastHealthcheck] =
      await Promise.all([
        safe('cronLogs', () => prisma.auditLog.findMany({
          where: { entityId: 'cron-stock-sync', ipAddress: 'cron' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, createdAt: true, description: true, metadata: true },
        }), []),

        safe('conflictCount', () => prisma.onewmsStockSync.count({
          where: { syncStatus: 'conflict' },
        }), 0),

        safe('failedOrderCount', () => prisma.onewmsOrderMapping.count({
          where: { status: 'failed' },
        }), 0),

        safe('conflicts', () => getStockConflicts(), []),

        safe('conflictTrend', () => prisma.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT TO_CHAR("syncedAt"::date, 'YYYY-MM-DD') as date,
                 COUNT(*)::int as count
          FROM "OnewmsStockSync"
          WHERE "syncStatus" = 'conflict'
            AND "syncedAt" >= NOW() - INTERVAL '7 days'
          GROUP BY "syncedAt"::date
          ORDER BY "syncedAt"::date
        `, []),

        safe('lastHealthcheck', () => prisma.auditLog.findFirst({
          where: { entityId: 'healthcheck' },
          orderBy: { createdAt: 'desc' },
          select: { metadata: true, createdAt: true },
        }), null),
      ]);

    // Build summary
    const lastSync = cronLogs[0] || null;
    const lastSyncMeta = lastSync?.metadata as Record<string, unknown> | null;
    const healthcheckMeta = lastHealthcheck?.metadata as Record<string, unknown> | null;

    const summary = {
      lastSyncTime: lastSync?.createdAt?.toISOString() ?? null,
      lastSyncDuration: (lastSyncMeta?.durationMs as number) ?? null,
      matchRate: (healthcheckMeta?.matchRate as number) ?? null,
      lastHealthcheckTime: lastHealthcheck?.createdAt?.toISOString() ?? null,
      activeConflicts: conflictCount,
      failedOrders: failedOrderCount,
    };

    return ok({
      summary,
      cronHistory: cronLogs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        description: log.description,
        metadata: log.metadata,
      })),
      conflictTrend,
      conflicts,
    });
  }
);

// ─── POST: On-demand healthcheck ───

export const POST = withRole(
  ['MASTER'],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const body = await req.json();

      if (body.action !== 'healthcheck') {
        return errors.badRequest('Unknown action');
      }

      const result = await runHealthcheck();

      // Log healthcheck to AuditLog
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.userId,
            userName: user.name || '마스터',
            userRole: user.role,
            action: 'UPDATE',
            entityType: 'System',
            entityId: 'healthcheck',
            entityName: 'Stock Healthcheck',
            description: `수동 일치율 검증: ${result.matchRate}% (${result.matchCount}/${result.sampleSize}, errors: ${result.errorCount})`,
            metadata: JSON.parse(JSON.stringify(result)),
            ipAddress: 'manual',
            userAgent: req.headers.get('user-agent') || 'browser',
          },
        });
      } catch (auditError) {
        console.error('[SYNC-MONITOR] AuditLog write failed:', auditError);
      }

      return ok(result);
    } catch (error) {
      console.error('[SYNC-MONITOR] POST failed:', error);
      return errors.internal('일치율 검증 실패');
    }
  }
);
