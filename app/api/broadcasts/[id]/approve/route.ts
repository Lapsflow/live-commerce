import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";
import { logAudit } from "@/lib/services/audit";

/**
 * PUT /api/broadcasts/:id/approve
 * REQUESTED → SCHEDULED (관리자/마스터 승인)
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    const segments = req.nextUrl.pathname.split("/");
    const approveIdx = segments.indexOf("approve");
    const broadcastId = segments[approveIdx - 1];

    if (!broadcastId) {
      return errors.badRequest("Broadcast ID가 필요합니다");
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      return errors.notFound("broadcast");
    }

    if (broadcast.status !== "REQUESTED") {
      return errors.badRequest("신청 대기 상태의 방송만 승인할 수 있습니다");
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "SCHEDULED" },
      include: { seller: { select: { name: true, phone: true, email: true } } },
    });

    // LIVE-09: 방송 승인 알림 → 셀러
    // Bug #6 fix: Vercel serverless에서 fire-and-forget이 killed될 수 있어 await로 변경
    if (updated.seller?.phone) {
      try {
        // 전화번호 정규화 (하이픈 제거 — Solapi 요구사항)
        const phoneNormalized = updated.seller.phone.replace(/-/g, "").trim();
        const result = await sendNotification({
          type: "BROADCAST_APPROVED",
          recipient: {
            name: updated.seller.name,
            phone: phoneNormalized,
            email: updated.seller.email || undefined,
          },
          variables: {
            broadcastTitle: updated.code || broadcastId,
            scheduledAt: updated.scheduledAt
              ? new Date(updated.scheduledAt).toLocaleString("ko-KR")
              : "-",
          },
          broadcastId,
        });
        if (!result.success) {
          console.error("[BROADCAST_APPROVE_NOTIFICATION] failed:", {
            phone: phoneNormalized,
            error: result.error,
            channel: result.channel,
          });
        }
      } catch (err) {
        console.error("[BROADCAST_APPROVE_NOTIFICATION] exception:", err);
      }
    } else {
      console.warn("[BROADCAST_APPROVE_NOTIFICATION] seller.phone missing:", {
        broadcastId,
        sellerId: updated.sellerId,
      });
    }

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: "STATUS_CHANGED",
      entityType: "Broadcast",
      entityId: broadcastId,
      entityName: broadcast.code,
      before: { status: "REQUESTED" },
      after: { status: "SCHEDULED" },
      description: `방송 승인: ${broadcast.code}`,
      request: req,
    });

    return ok(updated);
  }
);
