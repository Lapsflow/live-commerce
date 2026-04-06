import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/broadcasts/month/:ym
 *
 * 월간 방송 일정 조회
 * - 특정 월의 모든 방송 일정 조회
 *
 * Params:
 * - ym: YYYY-MM 형식 (예: 2024-03)
 *
 * 권한:
 * - SELLER: 본인 방송만 조회
 * - ADMIN: 소속 Seller 방송 조회
 * - MASTER, SUB_MASTER: 모든 방송 조회
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
      const ym = req.url.split("/").pop()?.split("?")[0];
      if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
        return errors.badRequest("올바른 날짜 형식이 아닙니다 (YYYY-MM)");
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;

      // 월의 시작일과 종료일 계산
      const [year, month] = ym.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // 역할 기반 필터 생성
      let sellerFilter = {};
      if (userRole === "SELLER") {
        sellerFilter = { sellerId: userId };
      } else if (userRole === "ADMIN") {
        // Admin이 관리하는 Seller 목록 조회
        const sellers = await prisma.user.findMany({
          where: { adminId: userId },
          select: { id: true },
        });
        const sellerIds = sellers.map((s) => s.id);
        sellerFilter = { sellerId: { in: sellerIds } };
      }

      // 방송 목록 조회
      const broadcasts = await prisma.broadcast.findMany({
        where: {
          ...sellerFilter,
          scheduledAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          scheduledAt: "asc",
        },
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
