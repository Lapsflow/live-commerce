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

      // 운영 검증(#7): Vercel serverless 의 fire-and-forget Promise kill 문제 → await 로 변경.
      // 셀러 SMS/알림톡이 컨펌 직후 항상 발송되도록 보장한다 (CLAUDE.md 학습 #8 패턴).
      let notificationError: string | null = null;
      if (order.seller.phone) {
        try {
          const phoneNormalized = order.seller.phone.replace(/-/g, "").trim();
          const notifResult = await sendNotification({
            type: "ORDER_CONFIRMED",
            recipient: {
              name: order.seller.name,
              phone: phoneNormalized,
              email: order.seller.email || undefined,
            },
            variables: {
              orderNo: order.orderNo,
              amount: order.totalAmount.toString(),
              expiryAt: expiryAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            orderId: order.id,
          });
          if (!notifResult.success) {
            notificationError = notifResult.error || "알림 발송 실패";
            console.error("[ORDER_CONFIRMED_NOTIF] failed:", { orderId, error: notificationError });
          }
        } catch (err) {
          notificationError = err instanceof Error ? err.message : "알림 발송 예외";
          console.error("[ORDER_CONFIRMED_NOTIF] exception:", err);
        }
      }

      // 운영 검증(#4): 본사 제품 발주는 컨펌 즉시 ONEWMS 등록.
      // await 로 변경하여 응답에 sync 결과 포함 (실패 시 관리자 화면 /admin/order-errors 에서 확인).
      const onewmsSync: { attempted: boolean; success: boolean; onewmsOrderNo?: string; error?: string } = {
        attempted: false,
        success: false,
      };
      if (order.productType === "HEADQUARTERS") {
        onewmsSync.attempted = true;
        try {
          const syncResult = await syncOrderToOnewms(orderId);
          onewmsSync.success = syncResult.success;
          onewmsSync.onewmsOrderNo = syncResult.onewmsOrderNo;
          onewmsSync.error = syncResult.error;
          if (!syncResult.success) {
            console.error("[AUTO_WMS_SYNC] failed:", orderId, syncResult.error);
          }
        } catch (err) {
          onewmsSync.error = err instanceof Error ? err.message : "ONEWMS sync 예외";
          console.error("[AUTO_WMS_SYNC] exception:", orderId, err);
        }
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
        after: {
          status: "APPROVED",
          notificationSent: notificationError === null,
          notificationError,
          onewmsSync,
        },
        description: `발주 컨펌: ${order.orderNo}${onewmsSync.attempted ? (onewmsSync.success ? " · ONEWMS 등록 성공" : ` · ONEWMS 등록 실패(${onewmsSync.error || "unknown"})`) : ""}`,
        request: req,
      });

      return ok({
        ...updated,
        notification: {
          attempted: !!order.seller.phone,
          success: notificationError === null,
          error: notificationError,
        },
        onewmsSync,
      });
    } catch (error) {
      console.error("[Order Confirm] Error:", error);
      return errors.internal("발주 컨펌 실패");
    }
  }
);
