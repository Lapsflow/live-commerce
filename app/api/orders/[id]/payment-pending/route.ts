import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";

/**
 * POST /api/orders/:id/payment-pending
 *
 * 입금확인중 상태 전환 (UNPAID → PENDING_CONFIRMATION)
 * MASTER/SUB_MASTER만 가능
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const orderId = req.url.split("/orders/")[1]?.split("/payment-pending")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: { select: { centerId: true } },
        },
      });

      if (!order) {
        return errors.notFound("발주를 찾을 수 없습니다");
      }

      // SUB_MASTER: 본인 센터 셀러의 발주만 처리 가능
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (order.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 처리할 수 있습니다");
        }
      }

      // 상태 검증: UNPAID 상태만 가능
      if (order.paymentStatus !== "UNPAID") {
        return errors.badRequest(
          `입금확인중으로 변경할 수 없습니다. 현재 상태: ${order.paymentStatus}`
        );
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PENDING_CONFIRMATION",
        },
      });

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "UPDATE",
        entityType: "Order",
        entityId: order.id,
        entityName: order.orderNo,
        before: { paymentStatus: "UNPAID" },
        after: { paymentStatus: "PENDING_CONFIRMATION" },
        description: `입금확인중으로 변경: ${order.orderNo}`,
        request: req,
      });

      return ok(updated);
    } catch (error) {
      console.error("[Payment Pending] Error:", error);
      return errors.internal("입금확인중 상태 변경 실패");
    }
  }
);
