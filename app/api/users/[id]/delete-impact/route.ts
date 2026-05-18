import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/users/:id/delete-impact
 *
 * 사용자 삭제 시 cascade 영향도 조회
 * 권한: MASTER
 */
export const GET = withRole(
  ["MASTER"],
  async (req: NextRequest) => {
    try {
      const userId = req.url.split("/").filter((s) => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, role: true },
      });

      if (!user) {
        return errors.notFound("user");
      }

      // Cascade 카운트 (함께 삭제될 항목)
      const [orderCount, broadcastCount] = await Promise.all([
        prisma.order.count({ where: { sellerId: userId } }),
        prisma.broadcast.count({ where: { sellerId: userId } }),
      ]);

      // SetNull 카운트 (이력 보존, 사용자만 null)
      const [saleCount, proposalCount, scanLogCount, auditLogCount] =
        await Promise.all([
          prisma.sale.count({ where: { sellerId: userId } }),
          prisma.proposal.count({ where: { submittedBy: userId } }),
          prisma.scanLog.count({ where: { userId: userId } }),
          prisma.auditLog.count({ where: { userId: userId } }),
        ]);

      return ok({
        cascade: {
          orders: orderCount,
          broadcasts: broadcastCount,
        },
        setNull: {
          sales: saleCount,
          proposals: proposalCount,
          scanLogs: scanLogCount,
          auditLogs: auditLogCount,
        },
        total: {
          willDelete: orderCount + broadcastCount,
          willPreserve:
            saleCount + proposalCount + scanLogCount + auditLogCount,
        },
      });
    } catch (err: any) {
      console.error("DELETE-IMPACT error:", err);
      return errors.internal(err.message);
    }
  }
);
