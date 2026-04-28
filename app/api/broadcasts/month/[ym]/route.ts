import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/broadcasts/month/:ym
 *
 * 월간 방송 일정 조회 (CAL-04: 필터 지원)
 *
 * Params:
 * - ym: YYYY-MM 형식 (예: 2024-03)
 *
 * Query params (CAL-04):
 * - platform: 채널 필터 (쉼표 구분, 예: GRIP,CLME)
 * - status: 상태 필터 (쉼표 구분, 예: SCHEDULED,LIVE)
 * - centerId: 센터 필터 (마스터만, 쉼표 구분)
 * - sellerName: 셀러명 검색 (부분 일치)
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      // URL에서 ym 파라미터 추출
      const url = new URL(req.url);
      const pathParts = url.pathname.split("/");
      const ym = pathParts[pathParts.length - 1];
      if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
        return errors.badRequest("올바른 날짜 형식이 아닙니다 (YYYY-MM)");
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // 월의 시작일과 종료일 계산
      const [year, month] = ym.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // CAL-04: 쿼리 파라미터 파싱
      const platformParam = url.searchParams.get("platform");
      const statusParam = url.searchParams.get("status");
      const centerIdParam = url.searchParams.get("centerId");
      const sellerNameParam = url.searchParams.get("sellerName");

      // where 조건 구성
      const where: any = {
        scheduledAt: { gte: startDate, lte: endDate },
      };

      // 역할 기반 필터
      if (userRole === "SELLER") {
        where.sellerId = userId;
      } else if (userRole === "ADMIN") {
        const sellers = await prisma.user.findMany({
          where: { adminId: userId },
          select: { id: true },
        });
        where.sellerId = { in: sellers.map((s) => s.id) };
      } else if (userRole === "SUB_MASTER") {
        // CAL-02: SUB_MASTER 센터 격리
        const userCenterId = (session.user as any).centerId;
        if (userCenterId) {
          where.centerId = userCenterId;
        }
      }

      // CAL-04: 채널 필터
      if (platformParam) {
        const platforms = platformParam.split(",").filter(Boolean);
        if (platforms.length > 0) {
          where.platform = { in: platforms };
        }
      }

      // CAL-04: 상태 필터
      if (statusParam) {
        const statuses = statusParam.split(",").filter(Boolean);
        if (statuses.length > 0) {
          where.status = { in: statuses };
        }
      }

      // CAL-04: 센터 필터 (마스터/서브마스터만)
      if (centerIdParam && (userRole === "MASTER" || userRole === "SUB_MASTER")) {
        const centerIds = centerIdParam.split(",").filter(Boolean);
        if (centerIds.length > 0) {
          where.centerId = { in: centerIds };
        }
      }

      // CAL-04: 셀러명 검색
      if (sellerNameParam) {
        where.seller = {
          name: { contains: sellerNameParam, mode: "insensitive" },
        };
      }

      const broadcasts = await prisma.broadcast.findMany({
        where,
        include: {
          seller: {
            select: { id: true, name: true, email: true },
          },
          center: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { scheduledAt: "asc" },
      });

      return ok({
        yearMonth: ym,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        broadcasts,
      });
    } catch (err: any) {
      console.error("Monthly broadcasts error:", err);
      return errors.internal(err.message);
    }
  }
);
