/**
 * GET /api/products/upload/history
 * 엑셀 업로드 이력 조회 (최근 30일)
 */

import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 30;

export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "0");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

    // SUB_MASTER: 본인 센터 업로드만
    const centerId = user.role === "SUB_MASTER" ? user.centerId : searchParams.get("centerId");

    const where: Record<string, unknown> = {
      action: "IMPORT",
      entityType: "Product",
      createdAt: { gte: since },
    };

    // centerId 필터 — metadata JSON 내부 필터는 Prisma에서 직접 불가
    // 전체 조회 후 필터링 (30일, 최대 수십건)
    const allLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        userName: true,
        userRole: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    });

    // centerId 기반 필터
    const filtered = centerId
      ? allLogs.filter((log) => {
          const meta = log.metadata as Record<string, unknown> | null;
          return meta?.mode === "UPSERT" && meta?.centerId === centerId;
        })
      : allLogs.filter((log) => {
          const meta = log.metadata as Record<string, unknown> | null;
          return meta?.mode === "UPSERT";
        });

    const total = filtered.length;
    const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const now = Date.now();
    const items = paginated.map((log) => {
      const meta = log.metadata as Record<string, unknown> | null;
      const stats = meta?.stats as Record<string, number> | undefined;
      const elapsed = now - log.createdAt.getTime();

      return {
        id: log.id,
        userName: log.userName,
        userRole: log.userRole,
        centerId: meta?.centerId,
        stats: stats ?? null,
        priceChangeCount: ((meta?.priceChanges as unknown[]) ?? []).length,
        durationMs: meta?.durationMs ?? null,
        canRollback: elapsed < ROLLBACK_WINDOW_MS,
        createdAt: log.createdAt.toISOString(),
      };
    });

    return ok({
      items,
      totalCount: total,
      pageCount: Math.ceil(total / pageSize),
    });
  }
);
