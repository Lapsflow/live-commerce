import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/admin/:id
 *
 * Admin 상세 통계 조회
 * - 특정 Admin의 소속 Seller별 매출, 건수, 마진
 * - 날짜 범위 필터링 지원 (fromDate, toDate)
 *
 * Query Parameters:
 * - fromDate?: YYYY-MM-DD (기본값: 30일 전)
 * - toDate?: YYYY-MM-DD (기본값: 오늘)
 *
 * 권한:
 * - ADMIN: 본인 ID만 조회 가능
 * - MASTER, SUB_MASTER: 모든 Admin 조회 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 adminId 추출
      const adminId = req.url.split("/").pop()?.split("?")[0];
      if (!adminId) {
        return errors.badRequest("Admin ID가 필요합니다");
      }
      const { searchParams } = new URL(req.url);

      // 날짜 범위 파라미터
      const fromDateStr = searchParams.get("fromDate");
      const toDateStr = searchParams.get("toDate");

      // 기본값: 최근 30일
      const toDate = toDateStr ? new Date(toDateStr) : new Date();
      const fromDate = fromDateStr
        ? new Date(fromDateStr)
        : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 권한 검증: ADMIN은 본인만 조회 가능
      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      if (userRole === "ADMIN" && userId !== adminId) {
        return errors.forbidden("본인의 통계만 조회할 수 있습니다");
      }

      // Admin 정보 조회
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!admin) {
        return errors.notFound("admin");
      }

      if (admin.role !== "ADMIN") {
        return errors.badRequest("ADMIN 역할의 사용자만 조회 가능합니다");
      }

      // 소속 Seller 목록 조회
      const sellers = await prisma.user.findMany({
        where: { adminId: adminId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (sellers.length === 0) {
        return ok({
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          },
          sellers: [],
          summary: {
            totalSales: 0,
            totalCount: 0,
            totalMargin: 0,
            avgPrice: 0,
          },
          dateRange: {
            fromDate: fromDate.toISOString().split("T")[0],
            toDate: toDate.toISOString().split("T")[0],
          },
        });
      }

      const sellerIds = sellers.map((s) => s.id);

      // Seller별 매출 통계 조회
      const sellerStats = await prisma.sale.groupBy({
        by: ["sellerId"],
        where: {
          sellerId: { in: sellerIds },
          saleDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        _sum: {
          totalPrice: true,
          quantity: true,
        },
        _avg: {
          unitPrice: true,
        },
        _count: true,
      });

      // Seller별 마진 계산
      const salesWithProducts = await prisma.sale.findMany({
        where: {
          sellerId: { in: sellerIds },
          saleDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        select: {
          sellerId: true,
          unitPrice: true,
          quantity: true,
          product: {
            select: {
              supplyPrice: true,
            },
          },
        },
      });

      // Seller별 마진 집계
      const marginBySeller = new Map<string, number>();
      salesWithProducts.forEach((sale) => {
        const margin =
          (sale.unitPrice - sale.product.supplyPrice) * sale.quantity;
        const currentMargin = marginBySeller.get(sale.sellerId) || 0;
        marginBySeller.set(sale.sellerId, currentMargin + margin);
      });

      // Seller 정보와 통계 병합
      const sellerMap = new Map(sellers.map((s) => [s.id, s]));
      const statsMap = new Map(sellerStats.map((s) => [s.sellerId, s]));

      const sellerDetails = sellers.map((seller) => {
        const stats = statsMap.get(seller.id);
        const margin = marginBySeller.get(seller.id) || 0;

        return {
          sellerId: seller.id,
          sellerName: seller.name,
          sellerEmail: seller.email,
          totalSales: stats?._sum.totalPrice || 0,
          count: stats?._count || 0,
          avgPrice: Math.round(stats?._avg.unitPrice || 0),
          totalMargin: margin,
        };
      });

      // 정렬: 매출 높은 순
      sellerDetails.sort((a, b) => b.totalSales - a.totalSales);

      // 전체 합계 계산
      const summary = sellerDetails.reduce(
        (acc, seller) => ({
          totalSales: acc.totalSales + seller.totalSales,
          totalCount: acc.totalCount + seller.count,
          totalMargin: acc.totalMargin + seller.totalMargin,
          avgPrice: 0, // 나중에 계산
        }),
        { totalSales: 0, totalCount: 0, totalMargin: 0, avgPrice: 0 }
      );

      summary.avgPrice =
        summary.totalCount > 0
          ? Math.round(summary.totalSales / summary.totalCount)
          : 0;

      return ok({
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
        sellers: sellerDetails,
        summary,
        dateRange: {
          fromDate: fromDate.toISOString().split("T")[0],
          toDate: toDate.toISOString().split("T")[0],
        },
      });
    } catch (err: any) {
      console.error("Admin stats error:", err);
      return errors.internal(err.message);
    }
  }
);
