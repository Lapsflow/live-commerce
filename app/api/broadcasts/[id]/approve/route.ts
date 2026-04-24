import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * PUT /api/broadcasts/:id/approve
 * REQUESTED → SCHEDULED (관리자/마스터 승인)
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest) => {
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
    });

    return ok(updated);
  }
);
