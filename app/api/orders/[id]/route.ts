import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";

/**
 * GET /api/orders/:id
 *
 * 발주 상세 조회
 * - 발주 정보 및 발주 항목 목록 조회
 *
 * 권한:
 * - SELLER: 본인 발주만 조회 가능
 * - SUB_MASTER: 본인 센터 셀러 발주만 조회 가능
 * - MASTER: 모든 발주 조회 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "SELLER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      // URL에서 orderId 추출
      const orderId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!orderId) {
        return errors.badRequest("Order ID가 필요합니다");
      }

      // 발주 조회
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              centerId: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  barcode: true,
                  sellPrice: true,
                  supplyPrice: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!order) {
        return errors.notFound("order");
      }

      // 권한 검증: SELLER는 본인 발주만
      if (user.role === "SELLER" && order.sellerId !== user.userId) {
        return errors.forbidden("본인의 발주만 조회할 수 있습니다");
      }

      // 권한 검증: SUB_MASTER는 본인 센터 셀러 발주만
      if (user.role === "SUB_MASTER" && user.centerId) {
        if (order.seller?.centerId !== user.centerId) {
          return errors.forbidden("본인 센터의 발주만 조회할 수 있습니다");
        }
      }

      return ok(order);
    } catch (err: any) {
      console.error("Order detail error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * DELETE /api/orders/:id
 *
 * 발주 영구 삭제 (MASTER 전용)
 * 관련 Cascade 삭제 대상:
 *   - OrderItem (line 255 Cascade)
 *   - OrderSellerMatching (line 381 Cascade)
 *   - StockReservation (line 403 Cascade)
 *   - OnewmsOrderMapping (line 567 Cascade)
 *   - Payment (line 611 Cascade)
 * SetNull: Sale.orderId (line 804) — 이력 보존
 */
export const DELETE = withRole(
  ["MASTER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      // URL: /api/orders/{id} → 마지막 segment 가 id
      const pathname = new URL(req.url).pathname;
      const segments = pathname.split("/").filter((s) => s);
      const orderId = segments[segments.length - 1];
      if (!orderId || orderId === "orders") {
        return errors.badRequest("Order ID가 필요합니다");
      }

      const existing = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNo: true,
          status: true,
          paymentStatus: true,
          shippingStatus: true,
          totalAmount: true,
          seller: { select: { name: true } },
        },
      });

      if (!existing) {
        return errors.notFound("발주를 찾을 수 없습니다");
      }

      await prisma.order.delete({ where: { id: orderId } });

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "DELETE",
        entityType: "Order",
        entityId: orderId,
        entityName: existing.orderNo,
        before: {
          orderNo: existing.orderNo,
          status: existing.status,
          paymentStatus: existing.paymentStatus,
          shippingStatus: existing.shippingStatus,
          totalAmount: existing.totalAmount,
        },
        description: `발주 영구 삭제: ${existing.orderNo} (셀러 ${existing.seller?.name || "-"})`,
        request: req,
      });

      return ok({
        message: "발주가 삭제되었습니다",
        deleted: { id: existing.id, orderNo: existing.orderNo },
      });
    } catch (err: any) {
      console.error("[ORDER DELETE] error:", err);
      if (err.code === "P2025") {
        return errors.notFound("발주를 찾을 수 없습니다");
      }
      return errors.internal(err.message || "발주 삭제 실패");
    }
  }
);
