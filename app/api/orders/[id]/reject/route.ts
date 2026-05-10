import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().min(1, "반려 사유를 입력해주세요").max(500),
});

/**
 * POST /api/orders/:id/reject
 *
 * 발주 반려 (PENDING → REJECTED)
 * SUB_MASTER/MASTER만 가능
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const orderId = req.url.split("/orders/")[1]?.split("/reject")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const body = await req.json();
      const validation = rejectSchema.safeParse(body);
      if (!validation.success) {
        return errors.badRequest("반려 사유를 입력해주세요");
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

      // SUB_MASTER: 본인 센터 셀러의 CENTER 발주만 반려 가능
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (order.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 반려할 수 있습니다");
        }
        if (order.productType === "HEADQUARTERS") {
          return errors.forbidden("본사 제품 발주의 반려는 본사에서 처리합니다");
        }
      }

      if (order.status !== "PENDING") {
        return errors.badRequest(`현재 상태(${order.status})에서는 반려할 수 없습니다. PENDING 상태만 반려 가능합니다.`);
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "REJECTED",
          cancelReason: validation.data.reason,
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
        before: { status: "PENDING" },
        after: { status: "REJECTED", reason: validation.data.reason },
        description: `발주 반려: ${order.orderNo} (사유: ${validation.data.reason})`,
        request: req,
      });

      return ok(updated);
    } catch (error) {
      console.error("[Order Reject] Error:", error);
      return errors.internal("발주 반려 실패");
    }
  }
);
