/**
 * Vercel Cron: Product Info Synchronization (가격 + 신규 상품)
 * Schedule: "*\/5 * * * *" (every 5 minutes)
 *
 * 속도 개선 (2026-06-10): stock-sync cron 에서 분리.
 *   - ONEWMS 상품 목록을 1회만 스캔하여 가격 sync 와 신규 상품 auto-import 가 공유.
 *     (기존: 두 함수가 각자 전체 스캔 → 중복 API 호출 제거)
 *   - 재고 cron 과 독립 실행이므로 재고 동기화 지연이 상품 정보 반영을 막지 않음.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAllOnewmsProducts,
  syncProductPricesFromOnewms,
  autoImportNewProducts,
} from '@/lib/services/onewms/productImport';
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

    console.log('Starting scheduled product sync (prices + auto-import)...');
    const startTime = Date.now();

    // ONEWMS 상품 목록 1회 스캔 → 두 단계가 공유
    const onewmsProducts = await fetchAllOnewmsProducts();

    // Sync product prices (originalPrice, sellPrice, supplyPrice) — HEADQUARTERS only
    const priceStats = await syncProductPricesFromOnewms(onewmsProducts);

    // Auto-import new ONEWMS products not yet in DB
    const autoImportStats = await autoImportNewProducts(onewmsProducts);

    const durationMs = Date.now() - startTime;
    console.log(`Scheduled product sync completed in ${durationMs}ms:`, {
      prices: priceStats,
      autoImport: autoImportStats,
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
          entityId: 'cron-product-sync',
          entityName: 'Product Sync Cron',
          description: `Cron product sync 완료: ${priceStats.updated} prices updated, ${autoImportStats.created} new products (${durationMs}ms)`,
          metadata: {
            durationMs,
            prices: JSON.parse(JSON.stringify(priceStats)),
            autoImport: JSON.parse(JSON.stringify(autoImportStats)),
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
      message: 'Product sync completed',
      priceStats,
      autoImportStats,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron product sync failed:', error);
    const message = error instanceof Error ? error.message : 'Product sync failed';

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
