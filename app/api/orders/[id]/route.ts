import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/orders/:id
 *
 * 발주 상세 조회
 * - 발주 정보 및 발주 항목 목록 조회
 *
 * 권한:
 * - SELLER: 본인 발주만 조회 가능
 * - SUB_MASTER: 본인 센터 셀러 발주만 조회 가능
 * - MASTER: 모든 발주 조회 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "SELLER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      // URL에서 orderId 추출
      const orderId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      // 발주 조회
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              centerId: true,
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

      // 권한 검증: SELLER는 본인 발주만
      if (user.role === "SELLER" && order.sellerId !== user.userId) {
        return errors.forbidden("본인의 발주만 조회할 수 있습니다");
      }

      // 권한 검증: SUB_MASTER는 본인 센터 셀러 발주만
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (order.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 조회할 수 있습니다");
        }
      }

      return ok(order);
    } catch (err: any) {
      console.error("Order detail error:", err);
      return errors.internal(err.message);
    }
  }
);
