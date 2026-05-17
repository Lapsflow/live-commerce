import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

// ✅ B-4: UploadJob 스테일 상태 정리 (every 5 minutes)
export async function GET(req: NextRequest) {
  try {
    // ✅ Vercel Cron 인증 확인
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 5분 이상 처리 중 상태의 Job을 실패 상태로 변경
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const updated = await prisma.uploadJob.updateMany({
      where: {
        status: "processing",
        createdAt: { lt: fiveMinutesAgo },
      },
      data: {
        status: "failed",
        errorMessage: "타임아웃: 5분 이상 처리 중 상태가 유지되었습니다",
      },
    });

    console.log(`[CLEANUP UPLOAD JOBS] Marked ${updated.count} stale jobs as failed`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updated.count,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[CLEANUP UPLOAD JOBS ERROR]", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
