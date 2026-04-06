import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/seller/analytics
 *
 * Seller 주간 성과 비교 (Week-over-Week)
 * - 이번 주 vs 지난 주 매출, 건수 비교
 * - 성장률 계산
 *
 * Query Parameters:
 * - sellerId: Seller ID (필수)
 *
 * 권한:
 * - SELLER: 본인 ID만 조회 가능
 * - ADMIN: 관리하는 Seller만 조회 가능
 * - MASTER, SUB_MASTER: 모든 Seller 조회 가능
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");

    if (!sellerId) {
      return errors.badRequest("sellerId 파라미터가 필요합니다");
    }

    // 권한 검증
    const userRole = (session.user as any).role;
    const userId = (session.user as any).userId;

    // Seller는 본인만 조회
    if (userRole === "SELLER" && userId !== sellerId) {
      return errors.forbidden("본인의 통계만 조회할 수 있습니다");
    }

    // Seller 정보 조회 및 권한 확인
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        adminId: true,
      },
    });

    if (!seller) {
      return errors.notFound("seller");
    }

    if (seller.role !== "SELLER") {
      return errors.badRequest("SELLER 역할의 사용자만 조회 가능합니다");
    }

    // ADMIN은 자신이 관리하는 Seller만 조회
    if (userRole === "ADMIN" && seller.adminId !== userId) {
      return errors.forbidden("관리하는 Seller의 통계만 조회할 수 있습니다");
    }

    // 주간 경계 계산 (월요일 시작)
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 (일요일) ~ 6 (토요일)
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    // 이번 주 시작 (월요일 00:00)
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - daysToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);

    // 이번 주 종료 (일요일 23:59)
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59, 999);

    // 지난 주 시작/종료
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekEnd);
    lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);

    // 이번 주 매출
    const thisWeekStats = await prisma.sale.aggregate({
      where: {
        sellerId: sellerId,
        saleDate: {
          gte: thisWeekStart,
          lte: thisWeekEnd,
        },
      },
      _sum: { totalPrice: true },
      _count: true,
    });

    const thisWeekSales = thisWeekStats._sum.totalPrice || 0;
    const thisWeekCount = thisWeekStats._count;

    // 지난 주 매출
    const lastWeekStats = await prisma.sale.aggregate({
      where: {
        sellerId: sellerId,
        saleDate: {
          gte: lastWeekStart,
          lte: lastWeekEnd,
        },
      },
      _sum: { totalPrice: true },
      _count: true,
    });

    const lastWeekSales = lastWeekStats._sum.totalPrice || 0;
    const lastWeekCount = lastWeekStats._count;

    // 성장률 계산
    const salesGrowthRate =
      lastWeekSales > 0
        ? ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100
        : thisWeekSales > 0
          ? 100
          : 0;

    const countGrowthRate =
      lastWeekCount > 0
        ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100
        : thisWeekCount > 0
          ? 100
          : 0;

    // 일별 매출 추이 (이번 주)
    const dailySalesRaw = await prisma.$queryRaw<
      Array<{ date: Date; totalSales: bigint; count: bigint }>
    >`
      SELECT
        DATE("saleDate") as date,
        SUM("totalPrice") as "totalSales",
        COUNT(*) as count
      FROM "Sale"
      WHERE "sellerId" = ${sellerId}
        AND "saleDate" >= ${thisWeekStart}
        AND "saleDate" <= ${thisWeekEnd}
      GROUP BY DATE("saleDate")
      ORDER BY date ASC
    `;

    const dailySales = dailySalesRaw.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      totalSales: Number(item.totalSales),
      count: Number(item.count),
    }));

    return ok({
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
      },
      thisWeek: {
        totalSales: thisWeekSales,
        count: thisWeekCount,
        startDate: thisWeekStart.toISOString().split("T")[0],
        endDate: thisWeekEnd.toISOString().split("T")[0],
      },
      lastWeek: {
        totalSales: lastWeekSales,
        count: lastWeekCount,
        startDate: lastWeekStart.toISOString().split("T")[0],
        endDate: lastWeekEnd.toISOString().split("T")[0],
      },
      growth: {
        salesGrowthRate: Math.round(salesGrowthRate * 10) / 10, // 소수점 1자리
        countGrowthRate: Math.round(countGrowthRate * 10) / 10,
        salesDiff: thisWeekSales - lastWeekSales,
        countDiff: thisWeekCount - lastWeekCount,
      },
      dailySales,
    });
  } catch (err: any) {
    console.error("Seller analytics error:", err);
    return errors.internal(err.message);
  }
}
