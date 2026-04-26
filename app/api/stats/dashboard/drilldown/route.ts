import { NextRequest } from "next/server";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getRoleBasedFilter } from "@/lib/api/role-filter";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/dashboard/drilldown
 *
 * 통계 카드 드릴다운 데이터
 * - type: sales | count | avgPrice | margin
 * - fromDate, toDate: YYYY-MM-DD
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

    const roleFilter = getRoleBasedFilter(session as any, "sale");
    const dateFilter = {
      ...roleFilter,
      saleDate: { gte: fromDate, lte: toDate },
    };

    if (type === "sales") {
      // 셀러별 매출 TOP 5
      const sellerTop = await prisma.sale.groupBy({
        by: ["sellerId"],
        where: dateFilter,
        _sum: { totalPrice: true },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 5,
      });

      const sellerIds = sellerTop.map((s) => s.sellerId);
      const sellers = await prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, name: true },
      });
      const sellerMap = new Map(sellers.map((s) => [s.id, s.name]));

      return ok({
        type: "sales",
        topItems: sellerTop.map((s) => ({
          name: sellerMap.get(s.sellerId) || "알 수 없음",
          value: s._sum.totalPrice || 0,
        })),
      });
    }

    if (type === "count") {
      // 상품별 판매 건수 TOP 5
      const productTop = await prisma.sale.groupBy({
        by: ["productId"],
        where: dateFilter,
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
      // 상품별 평균 단가 TOP 5
      const priceTop = await prisma.sale.groupBy({
        by: ["productId"],
        where: dateFilter,
        _avg: { unitPrice: true },
        _count: true,
        orderBy: { _avg: { unitPrice: "desc" } },
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
          value: Math.round(p._avg.unitPrice || 0),
          count: p._count,
        })),
      });
    }

    if (type === "margin") {
      // 상품별 마진 TOP 5
      const salesWithProducts = await prisma.sale.findMany({
        where: dateFilter,
        select: {
          productId: true,
          unitPrice: true,
          quantity: true,
          product: {
            select: { id: true, name: true, supplyPrice: true },
          },
        },
      });

      const marginByProduct = new Map<string, { name: string; margin: number; count: number }>();
      for (const sale of salesWithProducts) {
        const margin = (sale.unitPrice - sale.product.supplyPrice) * sale.quantity;
        const existing = marginByProduct.get(sale.productId);
        if (existing) {
          existing.margin += margin;
          existing.count += 1;
        } else {
          marginByProduct.set(sale.productId, {
            name: sale.product.name,
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
