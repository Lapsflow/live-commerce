import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/admin/audit-log
 * AuditLog 목록 조회 (MASTER 전용)
 *
 * Query params:
 * - userId: 특정 사용자 필터
 * - action: AuditAction 필터
 * - entityType: 엔티티 타입 필터
 * - entityId: 특정 엔티티 필터
 * - search: 설명/엔티티명 검색
 * - startDate, endDate: 날짜 범위
 * - pageIndex, pageSize: 페이지네이션
 */
export const GET = withRole(
  ["MASTER"],
  async (req: NextRequest, _user: AuthUser) => {
    try {
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get("userId");
      const action = searchParams.get("action");
      const entityType = searchParams.get("entityType");
      const entityId = searchParams.get("entityId");
      const search = searchParams.get("search");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const pageIndex = Math.max(0, parseInt(searchParams.get("pageIndex") || "0"));
      const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));

      const where: Record<string, unknown> = {};

      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;

      if (search) {
        where.OR = [
          { description: { contains: search, mode: "insensitive" } },
          { entityName: { contains: search, mode: "insensitive" } },
          { userName: { contains: search, mode: "insensitive" } },
        ];
      }

      if (startDate || endDate) {
        const dateFilter: Record<string, unknown> = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59.999Z");
        where.createdAt = dateFilter;
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          take: pageSize,
          skip: pageIndex * pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return paginated(logs, total, pageSize);
    } catch (err: any) {
      console.error("[AUDIT_LOG GET]", err);
      return errors.internal(err.message);
    }
  }
);
