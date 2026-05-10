import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";
import { z } from "zod";
import { logAudit } from "@/lib/services/audit";

const statusUpdateSchema = z.object({
  paymentStatus: z.enum(["UNPAID", "PAID", "PAYMENT_FAILED"]).optional(),
  shippingStatus: z.enum(["PENDING", "PREPARING", "SHIPPED", "PARTIAL"]).optional(),
});

/**
 * PUT /api/orders/:id/status
 *
 * 발주 상태 변경 (입금/출고)
 * 권한: MASTER, SUB_MASTER만 가능
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      // URL에서 orderId 추출
      const orderId = req.url.split("/").filter(s => s).slice(-2)[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const body = await req.json();
      const data = statusUpdateSchema.parse(body);

      // 최소 하나의 상태는 업데이트 되어야 함
      if (!data.paymentStatus && !data.shippingStatus) {
        return errors.badRequest("최소 하나의 상태를 업데이트해야 합니다");
      }

      // 발주가 존재하는지 확인
      const existing = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: { select: { centerId: true } },
        },
      });

      if (!existing) {
        return errors.notFound("order");
      }

      // SUB_MASTER: 본인 센터 셀러의 CENTER 발주만 상태 변경 가능
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (existing.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 상태 변경할 수 있습니다");
        }
        if (existing.productType === "HEADQUARTERS") {
          return errors.forbidden("본사 제품 발주의 상태 변경은 본사에서 처리합니다");
        }
      }

      // 상태 업데이트
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          ...(data.paymentStatus && { paymentStatus: data.paymentStatus }),
          ...(data.shippingStatus && { shippingStatus: data.shippingStatus }),
        },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      // ORDER-06: 출고완료 알림 → 셀러
      if (data.shippingStatus === "SHIPPED" && updated.seller?.phone) {
        sendNotification({
          type: "ORDER_SHIPPED",
          recipient: {
            name: updated.seller.name,
            phone: updated.seller.phone,
            email: updated.seller.email || undefined,
          },
          variables: {
            orderCode: updated.orderNo || orderId,
          },
          orderId,
        }).catch((err) => console.error("[ORDER_SHIPPED_NOTIFICATION]", err));
      }

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "STATUS_CHANGED",
        entityType: "Order",
        entityId: orderId,
        entityName: existing.orderNo,
        before: { paymentStatus: existing.paymentStatus, shippingStatus: existing.shippingStatus },
        after: data as Record<string, unknown>,
        description: `발주 상태 변경: ${existing.orderNo} (${data.paymentStatus || ""} ${data.shippingStatus || ""})`,
        request: req,
      });

      return ok(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      return errors.internal(err.message);
    }
  }
);
