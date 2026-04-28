/**
 * Vercel Cron: Broadcast 1-Hour Reminder
 * 매시간 실행 → 60~120분 후 시작 예정 방송의 셀러에게 정밀 리마인더 발송
 * Schedule: hourly (0 * * * *) — Vercel Pro 필요
 *
 * 중복 방지: Broadcast.reminder1hSentAt 필드 체크
 * 스펙 421번 줄: "방송 1시간 전 → 셀러 리마인더"
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

    console.log("[Broadcast-1h-Reminder] Starting...");

    const now = new Date();
    // 60분 ~ 120분 후 시작하는 방송 (1시간 전 알림)
    const from = new Date(now.getTime() + 60 * 60 * 1000);
    const to = new Date(now.getTime() + 120 * 60 * 1000);

    // SCHEDULED 상태 + 아직 리마인더 미발송 + 60~120분 후 시작
    const broadcasts = await prisma.broadcast.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          gte: from,
          lt: to,
        },
        reminder1hSentAt: null, // 중복 방지
      },
      include: {
        seller: {
          select: { name: true, phone: true, email: true },
        },
      },
    });

    if (broadcasts.length === 0) {
      console.log("[Broadcast-1h-Reminder] No broadcasts in 60-120min window");
      return NextResponse.json({
        success: true,
        message: "1시간 이내 예정 방송 없음",
        count: 0,
        timestamp: now.toISOString(),
      });
    }

    console.log(`[Broadcast-1h-Reminder] Found ${broadcasts.length} broadcasts`);

    let sent = 0;
    let failed = 0;

    for (const bc of broadcasts) {
      if (!bc.seller?.phone) continue;
      try {
        await sendNotification({
          type: "BROADCAST_REMINDER_1H",
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

        // 중복 방지 마킹
        await prisma.broadcast.update({
          where: { id: bc.id },
          data: { reminder1hSentAt: now },
        });

        sent++;
      } catch (err) {
        console.error(`[Broadcast-1h-Reminder] Failed for ${bc.code}:`, err);
        failed++;
      }
    }

    console.log(`[Broadcast-1h-Reminder] Done: ${sent} sent, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `${sent}건 1시간 전 리마인더 발송, ${failed}건 실패`,
      count: sent,
      failed,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[Broadcast-1h-Reminder] Cron failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
