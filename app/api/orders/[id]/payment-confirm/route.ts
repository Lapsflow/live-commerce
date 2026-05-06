import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";

/**
 * POST /api/orders/:id/payment-confirm
 *
 * 입금확인 (UNPAID → PAID)
 * SUB_MASTER/MASTER만 가능
 * 발주가 APPROVED 상태여야 함
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const orderId = req.url.split("/orders/")[1]?.split("/payment-confirm")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNo: true,
          status: true,
          paymentStatus: true,
        },
      });

      if (!order) {
        return errors.notFound("발주를 찾을 수 없습니다");
      }

      if (order.status !== "APPROVED") {
        return errors.badRequest(`발주가 승인(APPROVED) 상태가 아닙니다. 현재: ${order.status}`);
      }

      if (order.paymentStatus !== "UNPAID") {
        return errors.badRequest(`이미 입금 처리된 발주입니다. 현재: ${order.paymentStatus}`);
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
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
        after: { paymentStatus: "PAID" },
        description: `입금확인: ${order.orderNo}`,
        request: req,
      });

      return ok(updated);
    } catch (error) {
      console.error("[Payment Confirm] Error:", error);
      return errors.internal("입금확인 실패");
    }
  }
);
