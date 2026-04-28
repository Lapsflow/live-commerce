import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/proposals/samples
 *
 * 샘플 요청 목록 + 통계 (마스터 전용)
 *
 * Query Parameters:
 * - status?: PENDING | APPROVED | REJECTED
 * - centerId?: string
 * - search?: string (상품명, 업체명, 요청자명)
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get("status");
      const centerId = searchParams.get("centerId");
      const search = searchParams.get("search");

      // Build where clause
      const where: any = {
        category: "샘플",
      };

      if (statusFilter) {
        where.status = statusFilter;
      }

      if (centerId) {
        where.user = { centerId };
      }

      if (search) {
        where.OR = [
          { productName: { contains: search, mode: "insensitive" } },
          { companyName: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      // Fetch sample requests
      const proposals = await prisma.proposal.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              centerId: true,
              center: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Stats
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const allSampleThisMonth = await prisma.proposal.count({
        where: {
          category: "샘플",
          createdAt: { gte: startOfMonth },
        },
      });

      const [pending, approved, rejected] = await Promise.all([
        prisma.proposal.count({ where: { category: "샘플", status: "PENDING" } }),
        prisma.proposal.count({ where: { category: "샘플", status: "APPROVED" } }),
        prisma.proposal.count({ where: { category: "샘플", status: "REJECTED" } }),
      ]);

      // Center-level monthly counts
      const centerCounts = await prisma.proposal.groupBy({
        by: ["submittedBy"],
        where: {
          category: "샘플",
          createdAt: { gte: startOfMonth },
        },
        _count: true,
      });

      return ok({
        proposals,
        stats: {
          total: proposals.length,
          pending,
          approved,
          rejected,
          thisMonth: allSampleThisMonth,
          centerRequestCount: centerCounts.length,
        },
      });
    } catch (err: any) {
      console.error("Sample requests list error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * PUT /api/proposals/samples
 *
 * 일괄 상태 변경 (batch approve/reject)
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { ids, status } = body as { ids: string[]; status: string };

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errors.badRequest("요청 ID 목록이 필요합니다");
      }

      if (!["APPROVED", "REJECTED"].includes(status)) {
        return errors.badRequest("유효하지 않은 상태입니다");
      }

      const result = await prisma.proposal.updateMany({
        where: {
          id: { in: ids },
          category: "샘플",
          status: "PENDING",
        },
        data: { status: status as "APPROVED" | "REJECTED" },
      });

      return ok({
        message: `${result.count}건의 요청이 ${status === "APPROVED" ? "승인" : "거절"}되었습니다`,
        updatedCount: result.count,
      });
    } catch (err: any) {
      console.error("Batch status update error:", err);
      return errors.internal(err.message);
    }
  }
);
