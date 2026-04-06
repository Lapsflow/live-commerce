import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/orders/:id
 *
 * 발주 상세 조회
 * - 발주 정보 및 발주 항목 목록 조회
 *
 * 권한:
 * - SELLER: 본인 발주만 조회 가능
 * - ADMIN: 소속 Seller 발주 조회 가능
 * - MASTER, SUB_MASTER: 모든 발주 조회 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 orderId 추출
      const orderId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // 발주 조회
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              adminId: true,
            },
          },
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  barcode: true,
                  sellPrice: true,
                  supplyPrice: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!order) {
        return errors.notFound("order");
      }

      // 권한 검증
      if (userRole === "SELLER" && order.sellerId !== userId) {
        return errors.forbidden("본인의 발주만 조회할 수 있습니다");
      }

      if (userRole === "ADMIN" && order.seller.adminId !== userId) {
        return errors.forbidden("소속 Seller의 발주만 조회할 수 있습니다");
      }

      return ok(order);
    } catch (err: any) {
      console.error("Order detail error:", err);
      return errors.internal(err.message);
    }
  }
);
