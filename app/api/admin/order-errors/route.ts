import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/admin/order-errors
 *
 * 발주 오류 목록 (매칭 실패 + 재고 부족)
 * 권한: MASTER만
 * 페이지네이션: ?pageIndex=0&pageSize=50
 */
export const GET = withRole(
  ["MASTER"],
  async (req: NextRequest) => {
    try {
      const searchParams = req.nextUrl.searchParams;
      const pageIndex = Math.max(
        0,
        parseInt(searchParams.get("pageIndex") || "0")
      );
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("pageSize") || "50"))
      );

      // 오류 조건: OnewmsOrderMapping.status='failed' OR Order.stockShortageReason != null
      const total = await prisma.order.count({
        where: {
          OR: [
            { onewmsMapping: { status: "failed" } },
            { stockShortageReason: { not: null } },
          ],
        },
      });

      const items = await prisma.order.findMany({
        where: {
          OR: [
            { onewmsMapping: { status: "failed" } },
            { stockShortageReason: { not: null } },
          ],
        },
        include: {
          seller: {
            select: { id: true, name: true, phone: true },
          },
          processingCenter: {
            select: { id: true, name: true },
          },
          items: {
            take: 1,
            include: {
              product: {
                select: { id: true, name: true },
              },
            },
          },
          onewmsMapping: {
            select: { status: true, errorMessage: true },
          },
        },
        skip: pageIndex * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      });

      const formatted = items.map((order) => ({
        id: order.id,
        orderNumber: order.orderNo,
        sellerId: order.sellerId,
        centerName: order.processingCenter?.name || "미지정",
        sellerName: order.seller?.name || "삭제된 사용자",
        productName: order.items[0]?.product?.name || "상품 정보 없음",
        errorType:
          order.onewmsMapping?.status === "failed" ? "매칭실패" : "재고부족",
        message:
          order.onewmsMapping?.errorMessage ||
          order.stockShortageReason ||
          "오류 정보 없음",
        createdAt: order.createdAt,
        sellerPhone: order.seller?.phone || "",
      }));

      return ok({
        items: formatted,
        totalCount: total,
        pageSize,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("Order errors GET error:", err);
      return errors.internal(message);
    }
  }
);
