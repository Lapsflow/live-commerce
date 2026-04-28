import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";
import { z } from "zod";

const statusUpdateSchema = z.object({
  paymentStatus: z.enum(["UNPAID", "PAID", "PAYMENT_FAILED"]).optional(),
  shippingStatus: z.enum(["PENDING", "PREPARING", "SHIPPED", "PARTIAL"]).optional(),
});

/**
 * PUT /api/orders/:id/status
 *
 * 발주 상태 변경 (입금/출고)
 * 권한: MASTER, SUB_MASTER, ADMIN만 가능
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest) => {
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
      });

      if (!existing) {
        return errors.notFound("order");
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

      return ok(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      return errors.internal(err.message);
    }
  }
);
