import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";
import { z } from "zod";
import { logAudit } from "@/lib/services/audit";

const rejectSchema = z.object({
  reason: z.string().min(1, "반려 사유를 입력해주세요").max(500),
});

/**
 * PUT /api/broadcasts/:id/reject
 * REQUESTED → REJECTED (관리자/마스터 반려)
 * B-3: rejectedAt, rejectedBy 기록 + 셀러 알림
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    const segments = req.nextUrl.pathname.split("/");
    const rejectIdx = segments.indexOf("reject");
    const broadcastId = segments[rejectIdx - 1];

    if (!broadcastId) {
      return errors.badRequest("Broadcast ID가 필요합니다");
    }

    const body = await req.json();
    const { reason } = rejectSchema.parse(body);

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: {
        seller: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!broadcast) {
      return errors.notFound("broadcast");
    }

    if (broadcast.status !== "REQUESTED") {
      return errors.badRequest("신청 대기 상태의 방송만 반려할 수 있습니다");
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: user.userId,
      },
    });

    // B-3: 셀러에게 반려 알림 (fire-and-forget)
    if (broadcast.seller?.phone) {
      sendNotification({
        type: "BROADCAST_REJECTED",
        recipient: {
          name: broadcast.seller.name,
          phone: broadcast.seller.phone,
          email: broadcast.seller.email || undefined,
        },
        variables: {
          broadcastTitle: broadcast.code,
          rejectionReason: reason,
        },
        broadcastId,
      }).catch((err) => console.error("[BROADCAST_REJECTED_NOTIF]", err));
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
      after: { status: "REJECTED", rejectionReason: reason, rejectedBy: user.userId },
      description: `방송 반려: ${broadcast.code} (${reason})`,
      request: req,
    });

    return ok(updated);
  }
);
