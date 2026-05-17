import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";
import { sendNotification } from "@/lib/services/notifications";
import { syncOrderToOnewms } from "@/lib/services/onewms/orderSync";

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

      // ✅ Task 2D: Request body에서 expiryAt 읽기
      let expiryAt: string | undefined;
      try {
        const body = await req.json();
        expiryAt = body.expiryAt;
      } catch {
        // Body 없거나 JSON 파싱 실패 시 무시
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: { select: { id: true, name: true, phone: true, email: true, centerId: true } },
        },
      });

      if (!order) {
        return errors.notFound("발주를 찾을 수 없습니다");
      }

      // SUB_MASTER: 본인 센터 셀러의 CENTER 발주만 컨펌 가능
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (order.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 컨펌할 수 있습니다");
        }
        if (order.productType === "HEADQUARTERS") {
          return errors.forbidden("본사 제품 발주는 본사에서 처리합니다");
        }
      }

      if (order.status !== "PENDING") {
        return errors.badRequest(`현재 상태(${order.status})에서는 컨펌할 수 없습니다. PENDING 상태만 컨펌 가능합니다.`);
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          // ✅ Task 2D: virtualAccountExpiry 저장 (expiresAt 아님!)
          virtualAccountExpiry: expiryAt ? new Date(expiryAt) : null,
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
            // ✅ Task 2D: 금액 및 입금기한 추가
            amount: order.totalAmount.toString(),
            expiryAt: expiryAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          orderId: order.id,
        }).catch((err) => console.error("[ORDER_CONFIRMED_NOTIF]", err));
      }

      // Phase 4: 본사 상품 발주 컨펌 시 ONEWMS 자동 동기화 (fire-and-forget)
      if (order.productType === "HEADQUARTERS") {
        syncOrderToOnewms(orderId).catch((err) =>
          console.error("[AUTO_WMS_SYNC]", orderId, err)
        );
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
