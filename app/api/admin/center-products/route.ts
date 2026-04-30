import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/admin/center-products
 * 전 센터 CENTER 상품 모니터링 (MASTER 전용)
 *
 * Query params:
 * - centerId: 특정 센터 필터
 * - search: 상품명/코드/바코드 검색
 * - category: 카테고리 필터
 * - showInactive: "true" 시 비활성 포함 (기본: 활성만)
 * - pageIndex, pageSize: 페이지네이션
 * - mode: "summary" 시 센터별 통계만 반환
 */
export const GET = withRole(
  ["MASTER"],
  async (req: NextRequest, _user: AuthUser) => {
    try {
      const { searchParams } = new URL(req.url);
      const centerId = searchParams.get("centerId");
      const search = searchParams.get("search");
      const category = searchParams.get("category");
      const showInactive = searchParams.get("showInactive") === "true";
      const mode = searchParams.get("mode");
      const pageIndex = Math.max(0, parseInt(searchParams.get("pageIndex") || "0"));
      const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));

      // summary 모드: 센터별 통계만 반환
      if (mode === "summary") {
        const centers = await prisma.center.findMany({
          select: { id: true, name: true, code: true, centerNumber: true, regionName: true },
          orderBy: { code: "asc" },
        });

        const stats = await Promise.all(
          centers.map(async (center) => {
            const [totalCount, activeCount, categoryStats] = await Promise.all([
              prisma.product.count({
                where: { productType: "CENTER", managedBy: center.id },
              }),
              prisma.product.count({
                where: { productType: "CENTER", managedBy: center.id, isActive: true },
              }),
              prisma.product.groupBy({
                by: ["category"],
                where: { productType: "CENTER", managedBy: center.id, isActive: true },
                _count: true,
              }),
            ]);

            return {
              centerId: center.id,
              centerName: center.name,
              centerCode: center.code,
              centerNumber: center.centerNumber,
              regionName: center.regionName,
              totalCount,
              activeCount,
              inactiveCount: totalCount - activeCount,
              categories: categoryStats.map((c) => ({
                category: c.category || "미분류",
                count: c._count,
              })),
            };
          })
        );

        // 전체 합계
        const totals = {
          totalCount: stats.reduce((s, c) => s + c.totalCount, 0),
          activeCount: stats.reduce((s, c) => s + c.activeCount, 0),
          inactiveCount: stats.reduce((s, c) => s + c.inactiveCount, 0),
          centerCount: stats.filter((c) => c.totalCount > 0).length,
        };

        return ok({ centers: stats, totals });
      }

      // 일반 모드: 상품 목록
      const where: Record<string, unknown> = {
        productType: "CENTER",
      };

      if (!showInactive) {
        where.isActive = true;
      }

      if (centerId) {
        where.managedBy = centerId;
      }

      if (category) {
        where.category = category === "미분류" ? null : category;
      }

      if (search) {
        where.AND = [
          {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          take: pageSize,
          skip: pageIndex * pageSize,
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({ where }),
      ]);

      // managedBy → center 정보 매핑
      const centerIds = [...new Set(products.map((p) => p.managedBy).filter(Boolean))] as string[];
      const centers = centerIds.length > 0
        ? await prisma.center.findMany({
            where: { id: { in: centerIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
      const centerMap = Object.fromEntries(centers.map((c) => [c.id, c]));

      const enriched = products.map((p) => ({
        ...p,
        center: p.managedBy ? centerMap[p.managedBy] || null : null,
      }));

      return paginated(enriched, total, pageSize);
    } catch (err: any) {
      console.error("[CENTER_PRODUCTS GET]", err);
      return errors.internal(err.message);
    }
  }
);
