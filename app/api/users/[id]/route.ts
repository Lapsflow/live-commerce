import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["MASTER", "SUB_MASTER", "SELLER"]).optional(),
  channels: z.array(z.string()).optional(),
  avgSales: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/users/:id
 *
 * 사용자 상세 조회
 * 권한: MASTER, SUB_MASTER만 가능
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    try {
      const userId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          channels: true,
          avgSales: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (!user) {
        return errors.notFound("user");
      }

      return ok(user);
    } catch (err: any) {
      console.error("User GET error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * PUT /api/users/:id
 *
 * 사용자 정보 수정
 * 권한: MASTER, SUB_MASTER만 가능
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const body = await req.json();
      const data = userUpdateSchema.parse(body);

      // 사용자 존재 여부 확인
      const existing = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        return errors.notFound("user");
      }

      // MASTER 계정 1개 강제 정책
      if (data.role === "MASTER" && existing.role !== "MASTER") {
        const masterCount = await prisma.user.count({
          where: { role: "MASTER" },
        });
        if (masterCount >= 1) {
          return errors.badRequest("마스터 계정은 1개만 허용됩니다");
        }
      }

      // 사용자 정보 업데이트
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.role !== undefined && { role: data.role }),
          ...(data.channels !== undefined && { channels: data.channels }),
          ...(data.avgSales !== undefined && { avgSales: data.avgSales }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          channels: true,
          avgSales: true,
          isActive: true,
          createdAt: true,
        },
      });

      // 역할 변경 시 ROLE_CHANGED, 그 외 UPDATE
      const action = data.role && data.role !== existing.role ? "ROLE_CHANGED" : "UPDATE";
      const currentUserId = (session.user as any).userId;
      logAudit({
        userId: currentUserId,
        userRole: (session.user as any).role,
        userName: (session.user as any).name,
        action,
        entityType: "User",
        entityId: userId,
        entityName: existing.name,
        before: { name: existing.name, phone: existing.phone, role: existing.role, isActive: existing.isActive },
        after: data as Record<string, unknown>,
        description: action === "ROLE_CHANGED"
          ? `역할 변경: ${existing.name} (${existing.role} → ${data.role})`
          : `사용자 수정: ${existing.name}`,
        request: req,
      });

      return ok(updatedUser);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      console.error("User PUT error:", err);
      return errors.internal(err.message);
    }
  }
);

/**
 * DELETE /api/users/:id
 *
 * 사용자 삭제 (cascade: Order, Broadcast / SetNull: Sale, Proposal, ScanLog, AuditLog)
 * 권한: MASTER만 가능
 */
export const DELETE = withRole(
  ["MASTER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userId = req.url.split("/").filter(s => s).pop()?.split("?")[0];
      if (!userId) {
        return errors.badRequest("User ID가 필요합니다");
      }

      const currentUserId = (session.user as any).userId;

      // 본인 삭제 방지
      if (userId === currentUserId) {
        return errors.badRequest("본인 계정은 삭제할 수 없습니다");
      }

      // 사용자 존재 여부 확인
      const existing = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        return errors.notFound("user");
      }

      // 삭제 전 cascade/setNull 카운트 조회
      const [orderCount, broadcastCount, saleCount, proposalCount, scanLogCount, auditLogCount] =
        await Promise.all([
          prisma.order.count({ where: { sellerId: userId } }),
          prisma.broadcast.count({ where: { sellerId: userId } }),
          prisma.sale.count({ where: { sellerId: userId } }),
          prisma.proposal.count({ where: { submittedBy: userId } }),
          prisma.scanLog.count({ where: { userId: userId } }),
          prisma.auditLog.count({ where: { userId: userId } }),
        ]);

      // 사용자 삭제 (cascade 자동 실행)
      await prisma.user.delete({
        where: { id: userId },
      });

      // Audit log: cascade/setNull 분류 메타데이터 기록
      logAudit({
        userId: currentUserId,
        userRole: (session.user as any).role,
        userName: (session.user as any).name,
        action: "DELETE",
        entityType: "User",
        entityId: userId,
        entityName: existing.name,
        before: { name: existing.name, role: existing.role, email: existing.email },
        metadata: {
          cascade: { orders: orderCount, broadcasts: broadcastCount },
          setNull: { sales: saleCount, proposals: proposalCount, scanLogs: scanLogCount, auditLogs: auditLogCount },
        } as Record<string, unknown>,
        description: `사용자 삭제: ${existing.name} (${existing.role}) - 발주 ${orderCount}건, 방송 ${broadcastCount}건 함께 삭제`,
        request: req,
      });

      return ok({ message: "사용자가 삭제되었습니다", id: userId });
    } catch (err: any) {
      console.error("User DELETE error:", err);
      return errors.internal(err.message);
    }
  }
);
