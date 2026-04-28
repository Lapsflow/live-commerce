/**
 * Vercel Cron: Broadcast Daily Reminder
 * 오늘 예정된 SCHEDULED 방송의 셀러에게 당일 일괄 리마인더 발송
 * Schedule: daily at 7:00 AM KST (UTC 22:00)
 *
 * 매일 07시에 오늘 예정된 모든 방송에 일괄 리마인더 전송.
 * 정밀 1시간 전 리마인더는 broadcast-1h-reminder (매시간 cron)에서 별도 처리.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Broadcast-Reminder] Starting...");

    // 오늘 00:00 ~ 23:59 (KST = UTC+9)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStart = new Date(kstNow);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(kstNow);
    todayEnd.setUTCHours(23, 59, 59, 999);
    // Convert back to UTC
    const utcStart = new Date(todayStart.getTime() - kstOffset);
    const utcEnd = new Date(todayEnd.getTime() - kstOffset);

    // 오늘 SCHEDULED 상태의 방송 조회
    const broadcasts = await prisma.broadcast.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          gte: utcStart,
          lte: utcEnd,
        },
      },
      include: {
        seller: {
          select: { name: true, phone: true, email: true },
        },
      },
    });

    if (broadcasts.length === 0) {
      console.log("[Broadcast-Reminder] No broadcasts scheduled for today");
      return NextResponse.json({
        success: true,
        message: "오늘 예정된 방송 없음",
        count: 0,
        timestamp: now.toISOString(),
      });
    }

    console.log(`[Broadcast-Reminder] Found ${broadcasts.length} broadcasts for today`);

    let sent = 0;
    let failed = 0;

    for (const bc of broadcasts) {
      if (!bc.seller?.phone) continue;
      try {
        await sendNotification({
          type: "BROADCAST_REMINDER",
          recipient: {
            name: bc.seller.name,
            phone: bc.seller.phone,
            email: bc.seller.email || undefined,
          },
          variables: {
            broadcastTitle: bc.code || bc.id,
            scheduledAt: bc.scheduledAt
              ? new Date(bc.scheduledAt).toLocaleString("ko-KR")
              : "-",
          },
          broadcastId: bc.id,
        });
        sent++;
      } catch (err) {
        console.error(`[Broadcast-Reminder] Failed for ${bc.code}:`, err);
        failed++;
      }
    }

    console.log(`[Broadcast-Reminder] Done: ${sent} sent, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `${sent}건 리마인더 발송, ${failed}건 실패`,
      count: sent,
      failed,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[Broadcast-Reminder] Cron failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
