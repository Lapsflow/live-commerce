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
  ["MASTER", "SUB_MASTER", "ADMIN"],
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
    if (updated.seller?.phone) {
      sendNotification({
        type: "BROADCAST_APPROVED",
        recipient: {
          name: updated.seller.name,
          phone: updated.seller.phone,
          email: updated.seller.email || undefined,
        },
        variables: {
          broadcastTitle: updated.code || broadcastId,
          scheduledAt: updated.scheduledAt
            ? new Date(updated.scheduledAt).toLocaleString("ko-KR")
            : "-",
        },
        broadcastId,
      }).catch((err) => console.error("[BROADCAST_APPROVE_NOTIFICATION]", err));
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
