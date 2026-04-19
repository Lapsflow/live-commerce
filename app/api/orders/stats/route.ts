/**
 * GET /api/orders/stats - 발주 파이프라인 통계
 * 입금대기, 입금완료/발송준비, 출고완료, 취소/만료 건수
 */

import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { prisma } from "@/lib/db/prisma";

export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      // 역할별 필터
      const baseWhere: any = {};
      if (user.role === "SELLER") {
        baseWhere.sellerId = user.userId;
      }

      const [
        pendingUnpaid,
        approvedPreparing,
        shipped,
        rejected,
        expiringSoon,
      ] = await Promise.all([
        // 입금대기: PENDING + UNPAID
        prisma.order.count({
          where: { ...baseWhere, status: "PENDING", paymentStatus: "UNPAID" },
        }),
        // 입금완료/발송준비: APPROVED + (PREPARING | PENDING shipping)
        prisma.order.count({
          where: {
            ...baseWhere,
            status: "APPROVED",
            paymentStatus: "PAID",
            shippingStatus: { in: ["PENDING", "PREPARING"] },
          },
        }),
        // 출고완료
        prisma.order.count({
          where: {
            ...baseWhere,
            shippingStatus: { in: ["SHIPPED", "PARTIAL"] },
          },
        }),
        // 취소/만료
        prisma.order.count({
          where: { ...baseWhere, status: "REJECTED" },
        }),
        // 만료임박 (1시간 이내)
        prisma.order.count({
          where: {
            ...baseWhere,
            status: "PENDING",
            paymentStatus: "UNPAID",
            expiresAt: {
              lte: new Date(Date.now() + 60 * 60 * 1000),
              gt: new Date(),
            },
          },
        }),
      ]);

      return ok({
        pendingUnpaid,
        approvedPreparing,
        shipped,
        rejected,
        expiringSoon,
        total: pendingUnpaid + approvedPreparing + shipped + rejected,
      });
    } catch (err: any) {
      console.error("[ORDER_STATS ERROR]", err);
      return error("STATS_FAILED", err.message, 500);
    }
  }
);
