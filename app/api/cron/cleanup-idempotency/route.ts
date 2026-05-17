import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

// ✅ B-4: IdempotencyKey TTL 정리 (daily at 01:00)
export async function GET(req: NextRequest) {
  try {
    // ✅ Vercel Cron 인증 확인
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 만료된 IdempotencyKey 삭제
    const deleted = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    console.log(`[CLEANUP IDEMPOTENCY] Deleted ${deleted.count} expired keys`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deleted.count,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[CLEANUP IDEMPOTENCY ERROR]", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
