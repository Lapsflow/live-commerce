import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().optional(),
});

/**
 * PUT /api/broadcasts/:id/cancel
 *
 * 방송 취소
 * - 방송을 CANCELED 상태로 변경
 * - 취소 사유 메모 추가 가능
 *
 * Body:
 * - reason?: string (취소 사유)
 *
 * 권한:
 * - SELLER: 본인 방송만 취소 가능
 * - ADMIN: 소속 Seller 방송 취소 가능
 * - MASTER, SUB_MASTER: 모든 방송 취소 가능
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
        return errors.forbidden("본인의 방송만 취소할 수 있습니다");
      }

      if (userRole === "ADMIN" && broadcast.seller.adminId !== userId) {
        return errors.forbidden("소속 Seller의 방송만 취소할 수 있습니다");
      }

      // 이미 종료된 방송은 취소 불가
      if (broadcast.status === "ENDED") {
        return errors.badRequest("종료된 방송은 취소할 수 없습니다");
      }

      // 이미 취소된 방송
      if (broadcast.status === "CANCELED") {
        return errors.badRequest("이미 취소된 방송입니다");
      }

      // 요청 본문 파싱 및 검증
      const body = await req.json().catch(() => ({}));
      const data = cancelSchema.parse(body);

      // 취소 사유를 메모에 추가
      const cancelMemo = data.reason
        ? `[취소] ${data.reason}${broadcast.memo ? ` | ${broadcast.memo}` : ""}`
        : broadcast.memo;

      // 방송 취소
      const updated = await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: "CANCELED",
          memo: cancelMemo,
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
      console.error("Broadcast cancel error:", err);

      if (err.name === "ZodError") {
        return errors.badRequest(err.issues[0].message);
      }

      return errors.internal(err.message);
    }
  }
);
