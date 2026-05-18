import { NextRequest, NextResponse } from "next/server";
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
 * 역할별 필터링:
 * - MASTER: 전체 데이터
 * - SUB_MASTER: 본인 센터에 방송 신청한 셀러들의 데이터
 * - SELLER: 본인 데이터만
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
    const { where: roleWhere, sellerIds } = await getRoleBasedFilter(session as any, "sale");

    // 날짜 범위 필터 추가
    const dateFilter = {
      ...roleWhere,
      saleDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    // 4개 쿼리 병렬 실행
    const [aggregates, dailySalesRaw, sellerRankingRaw, marginResult] = await Promise.all([
      // 1. 총 매출 및 건수, 평균 단가
      prisma.sale.aggregate({
        where: dateFilter,
        _sum: { totalPrice: true },
        _avg: { unitPrice: true },
        _count: true,
      }),

      // 2. 일별 매출 (raw SQL — sellerIds로 필터)
      sellerIds !== null
        ? prisma.$queryRaw<Array<{ date: Date; totalSales: bigint; count: bigint }>>`
            SELECT
              DATE("saleDate") as date,
              SUM("totalPrice") as "totalSales",
              COUNT(*) as count
            FROM "Sale"
            WHERE "saleDate" >= ${fromDate}
              AND "saleDate" <= ${toDate}
              AND "sellerId" = ANY(${sellerIds})
            GROUP BY DATE("saleDate")
            ORDER BY date ASC
          `
        : prisma.$queryRaw<Array<{ date: Date; totalSales: bigint; count: bigint }>>`
            SELECT
              DATE("saleDate") as date,
              SUM("totalPrice") as "totalSales",
              COUNT(*) as count
            FROM "Sale"
            WHERE "saleDate" >= ${fromDate}
              AND "saleDate" <= ${toDate}
            GROUP BY DATE("saleDate")
            ORDER BY date ASC
          `,

      // 3. 셀러 랭킹 (Top 10)
      prisma.sale.groupBy({
        by: ["sellerId"],
        where: dateFilter,
        _sum: { totalPrice: true },
        _count: true,
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 10,
      }),

      // 4. 총 마진 — DB에서 직접 계산
      sellerIds !== null
        ? prisma.$queryRaw<[{ totalMargin: bigint | null }]>`
            SELECT COALESCE(SUM((s."unitPrice" - p."supplyPrice") * s."quantity"), 0)::bigint as "totalMargin"
            FROM "Sale" s
            JOIN "Product" p ON s."productId" = p."id"
            WHERE s."saleDate" >= ${fromDate}
              AND s."saleDate" <= ${toDate}
              AND s."sellerId" = ANY(${sellerIds})
          `
        : prisma.$queryRaw<[{ totalMargin: bigint | null }]>`
            SELECT COALESCE(SUM((s."unitPrice" - p."supplyPrice") * s."quantity"), 0)::bigint as "totalMargin"
            FROM "Sale" s
            JOIN "Product" p ON s."productId" = p."id"
            WHERE s."saleDate" >= ${fromDate}
              AND s."saleDate" <= ${toDate}
          `,
    ]);

    const totalSales = aggregates._sum.totalPrice || 0;
    const totalCount = aggregates._count;
    const avgPrice = Math.round(aggregates._avg.unitPrice || 0);
    const totalMargin = Number(marginResult[0]?.totalMargin ?? 0);

    const dailySales = dailySalesRaw.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      totalSales: Number(item.totalSales),
      count: Number(item.count),
    }));

    // 셀러 정보 조회
    const sellerIdList = sellerRankingRaw
      .map((item) => item.sellerId)
      .filter((id): id is string => id !== null);
    const sellers = await prisma.user.findMany({
      where: { id: { in: sellerIdList } },
      select: { id: true, name: true },
    });

    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    const sellerRanking = sellerRankingRaw.map((item) => {
      const seller = item.sellerId ? sellerMap.get(item.sellerId) : null;
      return {
        sellerId: item.sellerId,
        sellerName: seller?.name || (item.sellerId ? "알 수 없음" : "삭제된 셀러"),
        totalSales: item._sum.totalPrice || 0,
        count: item._count,
      };
    });

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
    console.error("[Dashboard API] Error:", {
      message: err.message,
      stack: err.stack,
    });

    // 권한 에러인 경우 401, 그 외는 500
    if (err.message?.includes("권한") || err.message?.includes("역할") || err.message?.includes("인증")) {
      return NextResponse.json(
        { error: err.message || "권한이 없습니다. 다시 로그인해주세요." },
        { status: 401 }
      );
    }

    return errors.internal(err.message);
  }
}
