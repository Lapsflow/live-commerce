import { NextRequest } from "next/server";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getRoleBasedFilter } from "@/lib/api/role-filter";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/dashboard/drilldown
 *
 * 통계 카드 드릴다운 데이터 (발주 기반)
 * - type: sales | count | avgPrice | margin
 * - fromDate, toDate: YYYY-MM-DD
 *
 * 데이터 소스 변경 (2026-07-10): Sale(운영 0행) → Order/OrderItem.
 * 상세 사유는 app/api/stats/dashboard/route.ts 주석 참고.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");

    if (!type || !["sales", "count", "avgPrice", "margin"].includes(type)) {
      return errors.badRequest("Invalid type parameter");
    }

    const toDate = toDateStr ? new Date(toDateStr) : new Date();
    const fromDate = fromDateStr
      ? new Date(fromDateStr)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    // 종료일 당일 포함 (off-by-one 수정)
    const toDateEnd = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);

    const { where: roleWhere } = await getRoleBasedFilter(session as any, "order");
    const orderFilter = {
      ...roleWhere,
      status: "APPROVED" as const,
      createdAt: { gte: fromDate, lt: toDateEnd },
    };
    // OrderItem 조회용 — 소속 발주에 동일 필터 적용
    const itemFilter = { order: orderFilter };

    if (type === "sales") {
      // 셀러별 발주액 TOP 5
      const sellerTop = await prisma.order.groupBy({
        by: ["sellerId"],
        where: orderFilter,
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 5,
      });

      const sellerIds = sellerTop
        .map((s) => s.sellerId)
        .filter((id): id is string => id !== null);
      const sellers = await prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, name: true },
      });
      const sellerMap = new Map(sellers.map((s) => [s.id, s.name]));

      return ok({
        type: "sales",
        topItems: sellerTop.map((s) => ({
          name: s.sellerId ? sellerMap.get(s.sellerId) || "알 수 없음" : "삭제된 셀러",
          value: s._sum.totalAmount || 0,
        })),
      });
    }

    if (type === "count") {
      // 상품별 발주 건수 TOP 5
      const productTop = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: itemFilter,
        _count: true,
        orderBy: { _count: { productId: "desc" } },
        take: 5,
      });

      const productIds = productTop.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      return ok({
        type: "count",
        topItems: productTop.map((p) => ({
          name: productMap.get(p.productId) || "알 수 없음",
          value: p._count,
        })),
      });
    }

    if (type === "avgPrice") {
      // 상품별 평균 공급단가 TOP 5
      const priceTop = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: itemFilter,
        _avg: { supplyPrice: true },
        _count: true,
        orderBy: { _avg: { supplyPrice: "desc" } },
        take: 5,
      });

      const productIds = priceTop.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      return ok({
        type: "avgPrice",
        topItems: priceTop.map((p) => ({
          name: productMap.get(p.productId) || "알 수 없음",
          value: Math.round(p._avg.supplyPrice || 0),
          count: p._count,
        })),
      });
    }

    if (type === "margin") {
      // 상품별 마진 TOP 5 — (판매가 - 공급가) × 수량
      const itemsWithProducts = await prisma.orderItem.findMany({
        where: itemFilter,
        select: {
          productId: true,
          supplyPrice: true,
          quantity: true,
          product: {
            select: { id: true, name: true, sellPrice: true },
          },
        },
      });

      const marginByProduct = new Map<string, { name: string; margin: number; count: number }>();
      for (const item of itemsWithProducts) {
        const margin = (item.product.sellPrice - item.supplyPrice) * item.quantity;
        const existing = marginByProduct.get(item.productId);
        if (existing) {
          existing.margin += margin;
          existing.count += 1;
        } else {
          marginByProduct.set(item.productId, {
            name: item.product.name,
            margin,
            count: 1,
          });
        }
      }

      const topItems = Array.from(marginByProduct.values())
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 5)
        .map((item) => ({
          name: item.name,
          value: item.margin,
          count: item.count,
        }));

      return ok({ type: "margin", topItems });
    }

    return errors.badRequest("Invalid type");
  } catch (err: any) {
    console.error("[Drilldown API] Error:", err.message);
    return errors.internal(err.message);
  }
}
