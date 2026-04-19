/**
 * POST /api/orders/[id]/cancel - 발주 취소
 * 셀러(본인 주문) 또는 관리자가 미입금 발주를 취소
 * - 재고 선점 해제
 * - 주문 상태 REJECTED
 */

import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { releaseStock } from "@/lib/services/stock/reservation";
import { prisma } from "@/lib/db/prisma";

export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (
    req: NextRequest,
    user: AuthUser,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: orderId } = await params;

      // 1. 주문 확인
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          sellerId: true,
          status: true,
          paymentStatus: true,
        },
      });

      if (!order) {
        return error("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.", 404);
      }

      // 2. 취소 가능 여부 확인
      if (order.paymentStatus === "PAID") {
        return error(
          "CANNOT_CANCEL_PAID",
          "입금완료된 발주는 취소할 수 없습니다. 관리자에게 문의하세요.",
          400
        );
      }

      if (order.status === "REJECTED") {
        return error("ALREADY_CANCELLED", "이미 취소된 발주입니다.", 400);
      }

      // 3. 권한 확인: SELLER는 본인 주문만 취소 가능
      if (user.role === "SELLER" && order.sellerId !== user.userId) {
        return error("FORBIDDEN", "본인의 발주만 취소할 수 있습니다.", 403);
      }

      // 4. 재고 해제 + 주문 취소
      const reason = user.role === "SELLER" ? "SELLER_CANCELLED" : "ADMIN_CANCELLED";
      const result = await releaseStock(orderId, reason);

      if (!result.success) {
        return error("CANCEL_FAILED", result.error || "취소 처리 실패", 500);
      }

      return ok({
        message: "발주가 취소되었습니다.",
        orderId,
        released: result.released,
      });
    } catch (err: any) {
      console.error("[ORDER_CANCEL ERROR]", err);
      return error("CANCEL_ERROR", err.message, 500);
    }
  }
);
