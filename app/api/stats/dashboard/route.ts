import { NextRequest } from "next/server";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getRoleBasedFilter } from "@/lib/api/role-filter";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/dashboard
 *
 * 통계 대시보드 데이터 조회
 * - 총 매출, 건수, 평균 단가, 마진
 * - 일별 매출 추이
 * - 셀러 랭킹 (Top 10)
 *
 * Query Parameters:
 * - fromDate?: YYYY-MM-DD (기본값: 30일 전)
 * - toDate?: YYYY-MM-DD (기본값: 오늘)
 *
 * 역할별 필터링 적용:
 * - 셀러: 본인 데이터만
 * - 관리자: 소속 셀러 데이터
 * - 마스터/부마스터: 전체 데이터
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(req.url);

    // 날짜 범위 파라미터
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");

    const toDate = toDateStr ? new Date(toDateStr) : new Date();
    const fromDate = fromDateStr
      ? new Date(fromDateStr)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 역할 기반 필터 적용
    const roleFilter = getRoleBasedFilter(session as any, "sale");

    // 날짜 범위 필터 추가
    const dateFilter = {
      ...roleFilter,
      saleDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    // 1. 총 매출 및 건수, 평균 단가
    const aggregates = await prisma.sale.aggregate({
      where: dateFilter,
      _sum: { totalPrice: true },
      _avg: { unitPrice: true },
      _count: true,
    });

    const totalSales = aggregates._sum.totalPrice || 0;
    const totalCount = aggregates._count;
    const avgPrice = Math.round(aggregates._avg.unitPrice || 0);

    // 2. 일별 매출
    const dailySalesRaw = roleFilter.sellerId
      ? await prisma.$queryRaw<Array<{ date: Date; totalSales: bigint; count: bigint }>>`
          SELECT
            DATE("saleDate") as date,
            SUM("totalPrice") as "totalSales",
            COUNT(*) as count
          FROM "Sale"
          WHERE "saleDate" >= ${fromDate}
            AND "saleDate" <= ${toDate}
            AND "sellerId" = ${roleFilter.sellerId}
          GROUP BY DATE("saleDate")
          ORDER BY date ASC
        `
      : await prisma.$queryRaw<Array<{ date: Date; totalSales: bigint; count: bigint }>>`
          SELECT
            DATE("saleDate") as date,
            SUM("totalPrice") as "totalSales",
            COUNT(*) as count
          FROM "Sale"
          WHERE "saleDate" >= ${fromDate}
            AND "saleDate" <= ${toDate}
          GROUP BY DATE("saleDate")
          ORDER BY date ASC
        `;

    const dailySales = dailySalesRaw.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      totalSales: Number(item.totalSales),
      count: Number(item.count),
    }));

    // 3. 셀러 랭킹 (Top 10)
    const sellerRankingRaw = await prisma.sale.groupBy({
      by: ["sellerId"],
      where: dateFilter,
      _sum: { totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 10,
    });

    // 셀러 정보 조회
    const sellerIds = sellerRankingRaw.map((item) => item.sellerId);
    const sellers = await prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true },
    });

    const sellerMap = new Map(sellers.map((s) => [s.id, s.name]));

    const sellerRanking = sellerRankingRaw.map((item) => ({
      sellerId: item.sellerId,
      sellerName: sellerMap.get(item.sellerId) || "알 수 없음",
      totalSales: item._sum.totalPrice || 0,
      count: item._count,
    }));

    // 4. 총 마진 계산 (판매가 - 공급가)
    const salesWithProducts = await prisma.sale.findMany({
      where: dateFilter,
      select: {
        unitPrice: true,
        quantity: true,
        product: {
          select: {
            supplyPrice: true,
          },
        },
      },
    });

    const totalMargin = salesWithProducts.reduce((sum, sale) => {
      const margin = (sale.unitPrice - sale.product.supplyPrice) * sale.quantity;
      return sum + margin;
    }, 0);

    return ok({
      totalSales,
      totalCount,
      avgPrice,
      totalMargin,
      dailySales,
      sellerRanking,
      dateRange: {
        fromDate: fromDate.toISOString().split("T")[0],
        toDate: toDate.toISOString().split("T")[0],
      },
    });
  } catch (err: any) {
    console.error("Dashboard stats error:", err);
    return errors.internal(err.message);
  }
}
