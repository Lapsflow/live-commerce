import { NextRequest, NextResponse } from "next/server";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { getRoleBasedFilter } from "@/lib/api/role-filter";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/dashboard
 *
 * 통계 대시보드 데이터 조회 (발주 기반)
 * - 총 발주액, 발주 건수, 평균 발주액, 총 마진
 * - 일별 발주 추이
 * - 셀러 랭킹 (Top 10)
 *
 * ─────────────────────────────────────────────────────────────
 * 데이터 소스 변경 (2026-07-10, docs/FEATURE_AUDIT 후속):
 *   기존: Sale 테이블 집계 — 그러나 운영 플로우(발주 승인/결제)는 Sale 을
 *   생성하지 않고, Sale 입력 화면(/sales)은 사이드바 미연결 고아 라우트라
 *   운영 DB 의 Sale 은 0행 → 대시보드가 항상 0 표시.
 *   변경: 실제 업무 데이터인 Order(승인된 발주, status=APPROVED) 기준 집계.
 *   마진은 Order.totalMargin(발주 생성 시 계산 저장) 합산.
 * ─────────────────────────────────────────────────────────────
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
    // 종료일 당일 포함 (기존: lte 자정 → 종료일 발주가 제외되던 off-by-one 수정)
    const toDateEnd = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);

    // 역할 기반 필터 적용 (order 모델: sellerId 기준)
    const { where: roleWhere, sellerIds } = await getRoleBasedFilter(session as any, "order");

    // 승인된 발주 + 날짜 범위 필터
    const orderFilter = {
      ...roleWhere,
      status: "APPROVED" as const,
      createdAt: {
        gte: fromDate,
        lt: toDateEnd,
      },
    };

    // 3개 쿼리 병렬 실행
    const [aggregates, dailyOrdersRaw, sellerRankingRaw] = await Promise.all([
      // 1. 총 발주액·건수·평균 발주액·총 마진
      prisma.order.aggregate({
        where: orderFilter,
        _sum: { totalAmount: true, totalMargin: true },
        _avg: { totalAmount: true },
        _count: true,
      }),

      // 2. 일별 발주 추이 (raw SQL — sellerIds로 필터)
      sellerIds !== null
        ? prisma.$queryRaw<Array<{ date: Date; totalSales: bigint; count: bigint }>>`
            SELECT
              DATE("createdAt") as date,
              SUM("totalAmount") as "totalSales",
              COUNT(*) as count
            FROM "Order"
            WHERE "createdAt" >= ${fromDate}
              AND "createdAt" < ${toDateEnd}
              AND status = 'APPROVED'
              AND "sellerId" = ANY(${sellerIds})
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
          `
        : prisma.$queryRaw<Array<{ date: Date; totalSales: bigint; count: bigint }>>`
            SELECT
              DATE("createdAt") as date,
              SUM("totalAmount") as "totalSales",
              COUNT(*) as count
            FROM "Order"
            WHERE "createdAt" >= ${fromDate}
              AND "createdAt" < ${toDateEnd}
              AND status = 'APPROVED'
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
          `,

      // 3. 셀러 랭킹 (Top 10) — 발주액 기준
      prisma.order.groupBy({
        by: ["sellerId"],
        where: orderFilter,
        _sum: { totalAmount: true },
        _count: true,
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 10,
      }),
    ]);

    const totalSales = aggregates._sum.totalAmount || 0;
    const totalCount = aggregates._count;
    const avgPrice = Math.round(aggregates._avg.totalAmount || 0);
    const totalMargin = aggregates._sum.totalMargin || 0;

    const dailySales = dailyOrdersRaw.map((item) => ({
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
        totalSales: item._sum.totalAmount || 0,
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
