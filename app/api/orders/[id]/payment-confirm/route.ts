import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";
import { sendNotification } from "@/lib/services/notifications";
import { reserveStockBulk } from "@/lib/services/stock/reservation";
import { syncOrderToOnewms } from "@/lib/services/onewms/orderSync";

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

      // ✅ Task 2F: UNPAID / PENDING_CONFIRMATION / ON_HOLD(보류 해제 겸) 허용
      if (
        order.paymentStatus !== "UNPAID" &&
        order.paymentStatus !== "PENDING_CONFIRMATION" &&
        order.paymentStatus !== "ON_HOLD"
      ) {
        return errors.badRequest(`이미 입금 처리된 발주입니다. 현재: ${order.paymentStatus}`);
      }

      const beforePaymentStatus = order.paymentStatus;

      // 발주관리 개선(2026-07-10): 실제 이체일 ≠ 확인일 케이스 대비 — body 로
      // paidAt(YYYY-MM-DD) 지정 가능. 미지정 시 현재 시각.
      let paidAtInput: Date | null = null;
      try {
        const body = await req.json();
        if (body?.paidAt) {
          const d = new Date(body.paidAt);
          if (!Number.isNaN(d.getTime())) paidAtInput = d;
        }
      } catch {
        // body 없으면 무시
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          paidAt: paidAtInput ?? new Date(),
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

      // 운영 검증(#7): 입금확인 알림 → 셀러. fire-and-forget 대신 await 로 발송 보장.
      let notificationError: string | null = null;
      try {
        const seller = await prisma.user.findUnique({
          where: { id: order.sellerId },
          select: { name: true, phone: true, email: true },
        });
        if (seller?.phone) {
          const phoneNormalized = seller.phone.replace(/-/g, "").trim();
          const notifResult = await sendNotification({
            type: "ORDER_PAYMENT_CONFIRMED",
            recipient: { name: seller.name, phone: phoneNormalized, email: seller.email || undefined },
            variables: { orderNo: order.orderNo },
            orderId: order.id,
          });
          if (!notifResult.success) {
            notificationError = notifResult.error || "알림 발송 실패";
            console.error("[PAYMENT_CONFIRM_NOTIF] failed:", { orderId, error: notificationError });
          }
        }
      } catch (notifErr) {
        notificationError = notifErr instanceof Error ? notifErr.message : "알림 발송 예외";
        console.error("[PAYMENT_CONFIRM_NOTIF] exception:", notifErr);
      }

      // 운영 검증(#4): 입금완료 시점에 ONEWMS 등록 안전망.
      // 컨펌 시점에 sync 가 실패했거나, 혼합발주 분리 이전에 productType=null 로 누락되었던 케이스를 보완.
      // HEADQUARTERS 발주만 ONEWMS 등록 대상이며, 이미 sent 상태면 skip.
      const onewmsSync: { attempted: boolean; success: boolean; onewmsOrderNo?: string; error?: string; alreadySynced?: boolean } = {
        attempted: false,
        success: false,
      };
      if (order.productType === "HEADQUARTERS") {
        onewmsSync.attempted = true;
        try {
          const existing = await prisma.onewmsOrderMapping.findUnique({
            where: { orderId },
            select: { status: true, onewmsOrderNo: true },
          });
          if (existing?.status === "sent") {
            onewmsSync.success = true;
            onewmsSync.alreadySynced = true;
            onewmsSync.onewmsOrderNo = existing.onewmsOrderNo;
          } else {
            const syncResult = await syncOrderToOnewms(orderId);
            onewmsSync.success = syncResult.success;
            onewmsSync.onewmsOrderNo = syncResult.onewmsOrderNo;
            onewmsSync.error = syncResult.error;
            if (!syncResult.success) {
              console.error("[PAYMENT_CONFIRM_WMS_SYNC] failed:", orderId, syncResult.error);
            }
          }
        } catch (err) {
          onewmsSync.error = err instanceof Error ? err.message : "ONEWMS sync 예외";
          console.error("[PAYMENT_CONFIRM_WMS_SYNC] exception:", orderId, err);
        }
      }

      return ok({
        ...updated,
        notification: { success: notificationError === null, error: notificationError },
        onewmsSync,
      });
    } catch (error) {
      console.error("[Payment Confirm] Error:", error);
      return errors.internal("입금확인 실패");
    }
  }
);
