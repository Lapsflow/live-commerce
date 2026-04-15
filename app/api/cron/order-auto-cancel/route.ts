/**
 * Vercel Cron: Order Auto-Cancel
 * Runs every 10 minutes to auto-cancel orders pending for >3 hours
 * Schedule: every 10 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Auto-Cancel] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Auto-Cancel] Invalid cron authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Auto-Cancel] Starting scheduled order auto-cancel...');

    // Calculate cutoff time (3 hours ago)
    const threeHoursAgo = new Date(Date.now() - THREE_HOURS_MS);

    // Find expired orders (PENDING + UNPAID + >3 hours old)
    const expiredOrders = await prisma.order.findMany({
      where: {
        uploadedAt: { lt: threeHoursAgo },
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      },
      select: {
        id: true,
        orderNo: true,
        sellerId: true,
        uploadedAt: true,
        totalAmount: true,
      },
    });

    if (expiredOrders.length === 0) {
      console.log('[Auto-Cancel] No expired orders found');
      return NextResponse.json({
        success: true,
        message: '만료된 발주 없음',
        count: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[Auto-Cancel] Found ${expiredOrders.length} expired orders`);

    // Batch update orders to REJECTED status
    const orderIds = expiredOrders.map((o) => o.id);
    const updateResult = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
      },
      data: {
        status: 'REJECTED',
        memo: '3시간 경과 자동 취소',
      },
    });

    console.log(
      `[Auto-Cancel] Successfully cancelled ${updateResult.count} orders:`,
      orderIds
    );

    // Return detailed result
    return NextResponse.json({
      success: true,
      message: `${updateResult.count}건 자동 취소 처리`,
      count: updateResult.count,
      orderIds,
      orders: expiredOrders.map((o) => ({
        orderNo: o.orderNo,
        uploadedAt: o.uploadedAt,
        totalAmount: o.totalAmount,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Auto-Cancel] Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Auto-cancel failed';

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
