import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/stats/seller/:id
 *
 * Seller 기본 통계 조회
 * - 총 매출, 건수, 평균 단가, 마진
 * - 플랫폼별 성과
 * - 상품별 판매 순위
 * - 날짜 범위 필터링 지원
 *
 * Query Parameters:
 * - fromDate?: YYYY-MM-DD (기본값: 30일 전)
 * - toDate?: YYYY-MM-DD (기본값: 오늘)
 *
 * 권한:
 * - SELLER: 본인 ID만 조회 가능
 * - ADMIN: 관리하는 Seller만 조회 가능
 * - MASTER, SUB_MASTER: 모든 Seller 조회 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 sellerId 추출
      const sellerId = req.url.split("/").pop()?.split("?")[0];
      if (!sellerId) {
        return errors.badRequest("Seller ID가 필요합니다");
      }
      const { searchParams } = new URL(req.url);

      // 날짜 범위 파라미터
      const fromDateStr = searchParams.get("fromDate");
      const toDateStr = searchParams.get("toDate");

      const toDate = toDateStr ? new Date(toDateStr) : new Date();
      const fromDate = fromDateStr
        ? new Date(fromDateStr)
        : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 권한 검증
      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // Seller는 본인만 조회
      if (userRole === "SELLER" && userId !== sellerId) {
        return errors.forbidden("본인의 통계만 조회할 수 있습니다");
      }

      // Seller 정보 조회
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

      // 1. 총 매출 및 건수
      const aggregates = await prisma.sale.aggregate({
        where: {
          sellerId: sellerId,
          saleDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        _sum: { totalPrice: true, quantity: true },
        _avg: { unitPrice: true },
        _count: true,
      });

      const totalSales = aggregates._sum.totalPrice || 0;
      const totalCount = aggregates._count;
      const avgPrice = Math.round(aggregates._avg.unitPrice || 0);

      // 2. 마진 계산
      const salesWithProducts = await prisma.sale.findMany({
        where: {
          sellerId: sellerId,
          saleDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
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
        const margin =
          (sale.unitPrice - sale.product.supplyPrice) * sale.quantity;
        return sum + margin;
      }, 0);

      // 3. 방송별 성과 (플랫폼 포함)
      const broadcastStats = await prisma.sale.findMany({
        where: {
          sellerId: sellerId,
          saleDate: {
            gte: fromDate,
            lte: toDate,
          },
          broadcastId: { not: null },
        },
        select: {
          totalPrice: true,
          broadcast: {
            select: {
              platform: true,
            },
          },
        },
      });

      // 플랫폼별 집계
      const platformMap = new Map<string, { totalSales: number; count: number }>();
      broadcastStats.forEach((sale) => {
        const platform = sale.broadcast?.platform || "UNKNOWN";
        const current = platformMap.get(platform) || { totalSales: 0, count: 0 };
        platformMap.set(platform, {
          totalSales: current.totalSales + sale.totalPrice,
          count: current.count + 1,
        });
      });

      const platformBreakdown = Array.from(platformMap.entries()).map(([platform, stats]) => ({
        platform,
        totalSales: stats.totalSales,
        count: stats.count,
      }));

      // 4. 상품별 판매 순위 (Top 10)
      const productStats = await prisma.sale.groupBy({
        by: ["productId"],
        where: {
          sellerId: sellerId,
          saleDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        _sum: { totalPrice: true, quantity: true },
        _count: true,
        orderBy: {
          _sum: { totalPrice: "desc" },
        },
        take: 10,
      });

      // 상품 정보 조회
      const productIds = productStats.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, code: true },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      const topProducts = productStats.map((item) => {
        const product = productMap.get(item.productId);
        return {
          productId: item.productId,
          productName: product?.name || "알 수 없음",
          productCode: product?.code || "",
          totalSales: item._sum.totalPrice || 0,
          quantity: item._sum.quantity || 0,
          count: item._count,
        };
      });

      return ok({
        seller: {
          id: seller.id,
          name: seller.name,
          email: seller.email,
        },
        summary: {
          totalSales,
          totalCount,
          avgPrice,
          totalMargin,
        },
        platformBreakdown,
        topProducts,
        dateRange: {
          fromDate: fromDate.toISOString().split("T")[0],
          toDate: toDate.toISOString().split("T")[0],
        },
      });
    } catch (err: any) {
      console.error("Seller stats error:", err);
      return errors.internal(err.message);
    }
  }
);
