import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";
import { sendNotification } from "@/lib/services/notifications";

/**
 * POST /api/orders/:id/confirm
 *
 * 발주 컨펌 (PENDING → APPROVED)
 * SUB_MASTER/MASTER만 가능
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const orderId = req.url.split("/orders/")[1]?.split("/confirm")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: { select: { id: true, name: true, phone: true, email: true } },
        },
      });

      if (!order) {
        return errors.notFound("발주를 찾을 수 없습니다");
      }

      if (order.status !== "PENDING") {
        return errors.badRequest(`현재 상태(${order.status})에서는 컨펌할 수 없습니다. PENDING 상태만 컨펌 가능합니다.`);
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });

      // 셀러에게 알림
      if (order.seller.phone) {
        sendNotification({
          type: "ORDER_CONFIRMED",
          recipient: {
            name: order.seller.name,
            phone: order.seller.phone,
            email: order.seller.email || undefined,
          },
          variables: {
            orderNo: order.orderNo,
            sellerName: order.seller.name,
          },
          orderId: order.id,
        }).catch((err) => console.error("[ORDER_CONFIRMED_NOTIF]", err));
      }

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "UPDATE",
        entityType: "Order",
        entityId: order.id,
        entityName: order.orderNo,
        before: { status: "PENDING" },
        after: { status: "APPROVED" },
        description: `발주 컨펌: ${order.orderNo}`,
        request: req,
      });

      return ok(updated);
    } catch (error) {
      console.error("[Order Confirm] Error:", error);
      return errors.internal("발주 컨펌 실패");
    }
  }
);
