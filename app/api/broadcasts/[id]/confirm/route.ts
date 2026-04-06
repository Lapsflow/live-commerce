import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * PUT /api/broadcasts/:id/confirm
 *
 * 방송 확정
 * - 예정된 방송을 확정 상태로 변경
 * - 메모 추가 가능
 *
 * Body:
 * - memo?: string (확정 메모)
 *
 * 권한:
 * - SELLER: 본인 방송만 확정 가능
 * - ADMIN: 소속 Seller 방송 확정 가능
 * - MASTER, SUB_MASTER: 모든 방송 확정 가능
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 broadcastId 추출
      const broadcastId = req.url.split("/").filter(s => s).slice(-2)[0];
      if (!broadcastId) {
        return errors.badRequest("Broadcast ID가 필요합니다");
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // 방송 조회
      const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              adminId: true,
            },
          },
        },
      });

      if (!broadcast) {
        return errors.notFound("broadcast");
      }

      // 권한 검증
      if (userRole === "SELLER" && broadcast.sellerId !== userId) {
        return errors.forbidden("본인의 방송만 확정할 수 있습니다");
      }

      if (userRole === "ADMIN" && broadcast.seller.adminId !== userId) {
        return errors.forbidden("소속 Seller의 방송만 확정할 수 있습니다");
      }

      // 예정된 방송만 확정 가능
      if (broadcast.status !== "SCHEDULED") {
        return errors.badRequest("예정된 방송만 확정할 수 있습니다");
      }

      // 요청 본문 파싱
      const body = await req.json().catch(() => ({}));
      const memo = body.memo || broadcast.memo;

      // 방송 확정 (메모 업데이트)
      const updated = await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          memo: memo,
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
      console.error("Broadcast confirm error:", err);
      return errors.internal(err.message);
    }
  }
);
