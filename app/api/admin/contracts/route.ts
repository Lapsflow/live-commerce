import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { withRole } from "@/lib/api/middleware";

/**
 * GET /api/admin/contracts
 * PENDING 상태 셀러 목록 조회 (계약 승인 페이지용)
 */
export const GET = withRole(["MASTER", "SUB_MASTER", "ADMIN"], async () => {
  try {
    const pendingSellers = await prisma.user.findMany({
      where: {
        role: "SELLER",
        contractStatus: "PENDING",
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        channels: true,
        avgSales: true,
        contractStatus: true,
        centerId: true,
        center: {
          select: {
            code: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(pendingSellers);
  } catch (err: any) {
    console.error("[CONTRACTS LIST ERROR]", err);
    return error("FETCH_FAILED", err.message, 500);
  }
});
