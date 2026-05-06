/**
 * Vercel Cron: Stock Synchronization
 * Runs every 1 hour to sync stock, prices, and auto-import new products from ONEWMS
 * Schedule: "0 * * * *" (every hour)
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllStocks, deactivateOrphanProducts } from '@/lib/services/onewms/stockSync';
import { syncProductPricesFromOnewms, autoImportNewProducts } from '@/lib/services/onewms/productImport';
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

    console.log('Starting scheduled stock + price + orphan sync...');
    const startTime = Date.now();

    // Run stock synchronization
    const stats = await syncAllStocks();

    // Sync product prices (originalPrice, sellPrice, supplyPrice) — HEADQUARTERS only
    const priceStats = await syncProductPricesFromOnewms();

    // Auto-import new ONEWMS products not yet in DB
    const autoImportStats = await autoImportNewProducts();

    // Deactivate orphan HEADQUARTERS products not in ONEWMS, restore reappeared ones
    const orphanStats = await deactivateOrphanProducts();

    const durationMs = Date.now() - startTime;
    console.log(`Scheduled sync completed in ${durationMs}ms:`, { stock: stats, prices: priceStats, autoImport: autoImportStats, orphan: orphanStats });

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
          description: `Cron stock sync 완료: ${stats.synced}/${stats.totalProducts} synced, ${stats.conflicts} conflicts, ${autoImportStats.created} new products, ${stats.errors} errors (${durationMs}ms)`,
          metadata: {
            durationMs,
            stock: JSON.parse(JSON.stringify(stats)),
            prices: JSON.parse(JSON.stringify(priceStats)),
            autoImport: JSON.parse(JSON.stringify(autoImportStats)),
            orphan: JSON.parse(JSON.stringify(orphanStats)),
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
      message: 'Stock + price + orphan sync completed',
      stats,
      priceStats,
      autoImportStats,
      orphanStats,
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
