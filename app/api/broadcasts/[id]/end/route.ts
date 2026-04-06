import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * PUT /api/broadcasts/:id/end
 *
 * 방송 종료
 * - 상태를 LIVE → ENDED로 변경
 * - endedAt 타임스탬프 기록
 *
 * 권한: MASTER, SUB_MASTER, ADMIN, SELLER
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      // URL에서 broadcastId 추출
      const broadcastId = req.url.split("/").filter(s => s).slice(-2)[0];
      if (!broadcastId) {
        return errors.badRequest("Broadcast ID가 필요합니다");
      }

      // 방송이 존재하는지 확인
      const existing = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
      });

      if (!existing) {
        return errors.notFound("broadcast");
      }

      // 진행 중인 방송인지 확인
      if (existing.status !== "LIVE") {
        return errors.badRequest("진행 중인 방송만 종료할 수 있습니다");
      }

      // 방송 종료
      const updated = await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: "ENDED",
          endedAt: new Date(),
        },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return ok(updated);
    } catch (err: any) {
      return errors.internal(err.message);
    }
  }
);
