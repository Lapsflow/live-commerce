/**
 * Vercel Cron: ONEWMS Maintenance (고아 상품 정리 + 재고 이력 청소)
 * Schedule: "0 18 * * *" (every day 18:00 UTC = 03:00 KST)
 *
 * 속도 개선 (2026-06-10): stock-sync cron 에서 분리.
 *   급하지 않은 작업을 새벽 1회로 이동:
 *   1. deactivateOrphanProducts — ONEWMS 에서 삭제된 본사 상품 비활성화 / 재등장 복구
 *   2. OnewmsStockSync 이력 청소 — 테이블 비대 방지
 *      - 변동 없음(difference=0) 이력: 2일 경과 시 삭제 (구버전 cron 이 매 분 기록한 잔존분)
 *      - 변동 이력(synced/resolved): 30일 보관 후 삭제
 *      - conflict 이력: 삭제하지 않음 (운영 모니터링 데이터)
 */

import { NextRequest, NextResponse } from 'next/server';
import { deactivateOrphanProducts } from '@/lib/services/onewms/stockSync';
import { fetchAllOnewmsProducts } from '@/lib/services/onewms/productImport';
import { prisma } from '@/lib/db/prisma';

// Vercel Pro: 최대 5분
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Invalid cron authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting ONEWMS maintenance (orphan + history cleanup)...');
    const startTime = Date.now();

    // 1. 고아 상품 정리 (상품 목록 1회 스캔)
    const onewmsProducts = await fetchAllOnewmsProducts();
    const orphanStats = await deactivateOrphanProducts(onewmsProducts);

    // 2. 재고 이력 청소
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [noChangeDeleted, oldDeleted] = await prisma.$transaction([
      // 변동 없음 이력 (구버전 cron 의 매 분 전수 기록 잔존분)
      prisma.onewmsStockSync.deleteMany({
        where: {
          difference: 0,
          syncStatus: { not: 'conflict' },
          syncedAt: { lt: twoDaysAgo },
        },
      }),
      // 변동 이력 30일 보관
      prisma.onewmsStockSync.deleteMany({
        where: {
          syncStatus: { not: 'conflict' },
          syncedAt: { lt: thirtyDaysAgo },
        },
      }),
    ]);

    const cleanupStats = {
      noChangeDeleted: noChangeDeleted.count,
      oldDeleted: oldDeleted.count,
    };

    const durationMs = Date.now() - startTime;
    console.log(`ONEWMS maintenance completed in ${durationMs}ms:`, {
      orphan: orphanStats,
      cleanup: cleanupStats,
    });

    // AuditLog에 cron 실행 기록
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          userName: '시스템',
          userRole: 'MASTER',
          action: 'UPDATE',
          entityType: 'System',
          entityId: 'cron-onewms-maintenance',
          entityName: 'ONEWMS Maintenance Cron',
          description: `Cron maintenance 완료: orphan ${orphanStats.deactivated} deactivated / ${orphanStats.restored} restored, 이력 ${cleanupStats.noChangeDeleted + cleanupStats.oldDeleted}건 정리 (${durationMs}ms)`,
          metadata: {
            durationMs,
            orphan: JSON.parse(JSON.stringify(orphanStats)),
            cleanup: cleanupStats,
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
      message: 'ONEWMS maintenance completed',
      orphanStats,
      cleanupStats,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron ONEWMS maintenance failed:', error);
    const message = error instanceof Error ? error.message : 'Maintenance failed';

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
