/**
 * Vercel Cron: Stock Synchronization (재고 전용)
 * Schedule: "* * * * *" (every minute)
 *
 * 속도 개선 (2026-06-10, 운영 측 "상품·재고 반영 속도 우선" 방침):
 *   기존에는 이 cron 1개가 재고 + 가격 + 신규상품 import + 고아 정리를 직렬 실행.
 *   앞 단계가 느리면 뒤가 밀리고, maxDuration 초과 시 회차 전체 실패 → 반영 지연.
 *   분리 후:
 *     - 이 cron: 재고만 (1분, 경량화된 syncAllStocks)
 *     - /api/cron/product-sync: 가격 + 신규상품 (5분, 상품 목록 1회 스캔 공유)
 *     - /api/cron/onewms-maintenance: 고아 정리 + 이력 청소 (일 1회)
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllStocks } from '@/lib/services/onewms/stockSync';
import { prisma } from '@/lib/db/prisma';

// Vercel Pro: 최대 5분 (기본 10초 → 명시적으로 300초 설정)
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Invalid cron authorization');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled stock sync (stock-only)...');
    const startTime = Date.now();

    // Run stock synchronization only
    const stats = await syncAllStocks();

    const durationMs = Date.now() - startTime;
    console.log(`Scheduled stock sync completed in ${durationMs}ms:`, stats);

    // AuditLog에 cron 실행 기록
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          userName: '시스템',
          userRole: 'MASTER',
          action: 'UPDATE',
          entityType: 'System',
          entityId: 'cron-stock-sync',
          entityName: 'Stock Sync Cron',
          description: `Cron stock sync 완료: ${stats.synced}/${stats.totalProducts} synced, ${stats.errors} errors (${durationMs}ms)`,
          metadata: {
            durationMs,
            stock: JSON.parse(JSON.stringify(stats)),
          },
          ipAddress: 'cron',
          userAgent: 'vercel-cron/1.0',
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Stock sync completed',
      stats,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron stock sync failed:', error);
    const message = error instanceof Error ? error.message : 'Stock sync failed';

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
