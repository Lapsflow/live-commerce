// Vercel Cron: Order Auto-Cancel
// 3시간 경과 미입금 발주 자동 취소 + 재고 선점 해제
// Schedule: every 10 minutes

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { releaseStock } from "@/lib/services/stock/reservation";

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Auto-Cancel] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Auto-Cancel] Invalid cron authorization");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Auto-Cancel] Starting scheduled order auto-cancel...");

    const now = new Date();

    // expiresAt 기반 만료 조회 (기존 uploadedAt 대비 더 정확)
    // expiresAt가 없는 기존 주문은 uploadedAt + 3시간으로 fallback
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        paymentStatus: "UNPAID",
        OR: [
          { expiresAt: { lt: now } },
          {
            expiresAt: null,
            uploadedAt: { lt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
          },
        ],
      },
      select: {
        id: true,
        orderNo: true,
        sellerId: true,
        uploadedAt: true,
        expiresAt: true,
        totalAmount: true,
      },
    });

    if (expiredOrders.length === 0) {
      console.log("[Auto-Cancel] No expired orders found");
      return NextResponse.json({
        success: true,
        message: "만료된 발주 없음",
        count: 0,
        timestamp: now.toISOString(),
      });
    }

    console.log(
      `[Auto-Cancel] Found ${expiredOrders.length} expired orders`
    );

    // 각 주문에 대해 재고 해제 + 취소 처리
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ orderNo: string; error: string }> = [];

    for (const order of expiredOrders) {
      try {
        const result = await releaseStock(order.id, "EXPIRED");
        if (result.success) {
          succeeded++;
        } else {
          failed++;
          errors.push({
            orderNo: order.orderNo,
            error: result.error || "Unknown error",
          });
        }
      } catch (err: any) {
        failed++;
        errors.push({
          orderNo: order.orderNo,
          error: err.message,
        });
      }
    }

    console.log(
      `[Auto-Cancel] Completed: ${succeeded} cancelled, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      message: `${succeeded}건 자동 취소, ${failed}건 실패`,
      count: succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[Auto-Cancel] Cron job failed:", err);
    const message = err instanceof Error ? err.message : "Auto-cancel failed";

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
