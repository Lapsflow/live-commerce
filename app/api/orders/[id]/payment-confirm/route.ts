import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";
import { sendNotification } from "@/lib/services/notifications";
import { reserveStockBulk } from "@/lib/services/stock/reservation";

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
        include: {
          seller: { select: { centerId: true } },
        },
      });

      if (!order) {
        return errors.notFound("발주를 찾을 수 없습니다");
      }

      // SUB_MASTER: 본인 센터 셀러의 CENTER 발주만 입금확인 가능
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (order.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 입금확인할 수 있습니다");
        }
        if (order.productType === "HEADQUARTERS") {
          return errors.forbidden("본사 제품 발주의 입금확인은 본사에서 처리합니다");
        }
      }

      if (order.status !== "APPROVED") {
        return errors.badRequest(`발주가 승인(APPROVED) 상태가 아닙니다. 현재: ${order.status}`);
      }

      // ✅ Task 2F: UNPAID 또는 PENDING_CONFIRMATION 상태 모두 허용
      if (order.paymentStatus !== "UNPAID" && order.paymentStatus !== "PENDING_CONFIRMATION") {
        return errors.badRequest(`이미 입금 처리된 발주입니다. 현재: ${order.paymentStatus}`);
      }

      const beforePaymentStatus = order.paymentStatus;

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
        },
      });

      // ✅ Task 1: 입금 완료 시점에 재고 차감 (선착순)
      try {
        // 1. Order + items 재조회
        const orderWithItems = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: { include: { product: true } } },
        });

        if (orderWithItems?.items && orderWithItems.items.length > 0) {
          // 2. productId/qty Map 생성
          const reserveMap = new Map<string, number>();
          for (const item of orderWithItems.items) {
            reserveMap.set(item.productId, item.quantity);
          }

          // 3. reserveStockBulk 호출
          const reserveResult = await reserveStockBulk(reserveMap, {
            orderIds: [orderId],
          });

          // 4. 결과 처리 (자동 취소 X, 입금은 무조건 PAID)
          if (reserveResult.failed.length > 0) {
            // 일부/전부 실패: 재고 부족 기록
            await prisma.order.update({
              where: { id: orderId },
              data: {
                stockShortageReason: JSON.stringify(reserveResult.failed),
                stockShortageDetectedAt: new Date(),
              },
            });
            console.warn("[PAYMENT-CONFIRM] Stock shortage detected:", reserveResult.failed);
          }
        }
      } catch (err: any) {
        // 재고 차감 실패해도 입금 처리는 계속 (PDF §7.2)
        console.error("[PAYMENT-CONFIRM] Stock reservation error:", err);
        await prisma.order.update({
          where: { id: orderId },
          data: {
            stockShortageReason: JSON.stringify({
              error: err.message || "Stock reservation failed",
            }),
            stockShortageDetectedAt: new Date(),
          },
        });
      }

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "UPDATE",
        entityType: "Order",
        entityId: order.id,
        entityName: order.orderNo,
        // ✅ Task 2F: Before 상태 동적으로 기록 (UNPAID 또는 PENDING_CONFIRMATION)
        before: { paymentStatus: beforePaymentStatus },
        after: { paymentStatus: "PAID" },
        description: `입금확인: ${order.orderNo}`,
        request: req,
      });

      // Phase 7: 입금확인 알림 → 셀러 (fire-and-forget)
      try {
        const seller = await prisma.user.findUnique({
          where: { id: order.sellerId },
          select: { name: true, phone: true, email: true },
        });
        if (seller?.phone) {
          sendNotification({
            type: "ORDER_PAYMENT_CONFIRMED",
            recipient: { name: seller.name, phone: seller.phone, email: seller.email || undefined },
            variables: { orderNo: order.orderNo },
            orderId: order.id,
          }).catch((err) => console.error("[PAYMENT_CONFIRM_NOTIF]", err));
        }
      } catch (notifErr) {
        console.error("[PAYMENT_CONFIRM_NOTIF]", notifErr);
      }

      return ok(updated);
    } catch (error) {
      console.error("[Payment Confirm] Error:", error);
      return errors.internal("입금확인 실패");
    }
  }
);
