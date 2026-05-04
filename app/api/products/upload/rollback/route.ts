/**
 * POST /api/products/upload/rollback
 * 엑셀 업로드 롤백 (24시간 이내만 가능)
 */

import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/services/audit";

const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, user) => {
    const body = await req.json();
    const { auditLogId } = body;

    if (!auditLogId) {
      return errors.badRequest("auditLogId가 필요합니다");
    }

    // AuditLog 조회
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: auditLogId },
    });

    if (!auditLog) {
      return errors.notFound("업로드 이력");
    }

    if (auditLog.action !== "IMPORT" || auditLog.entityType !== "Product") {
      return errors.badRequest("엑셀 업로드 이력만 롤백할 수 있습니다");
    }

    const metadata = auditLog.metadata as Record<string, unknown> | null;
    if (!metadata || metadata.mode !== "UPSERT") {
      return errors.badRequest("Upsert 업로드만 롤백할 수 있습니다");
    }

    // 24시간 이내 체크
    const elapsed = Date.now() - auditLog.createdAt.getTime();
    if (elapsed > ROLLBACK_WINDOW_MS) {
      return errors.badRequest("24시간 이후에는 롤백할 수 없습니다");
    }

    // SUB_MASTER: 본인 센터 체크
    const centerId = metadata.centerId as string;
    if (user.role === "SUB_MASTER" && user.centerId && centerId !== user.centerId) {
      return errors.forbidden("본인 센터의 업로드만 롤백할 수 있습니다");
    }

    const deactivatedProductIds = (metadata.deactivatedProductIds as string[]) || [];
    const createdProductIds = (metadata.createdProductIds as string[]) || [];
    const beforeStates = (auditLog.before as Record<string, Record<string, unknown>>) || {};

    // 트랜잭션으로 롤백
    await prisma.$transaction(
      async (tx) => {
        // 1. 비활성화됐던 상품 복원
        if (deactivatedProductIds.length > 0) {
          await tx.product.updateMany({
            where: { id: { in: deactivatedProductIds } },
            data: {
              isActive: true,
              deactivatedAt: null,
              deactivatedReason: null,
            },
          });
        }

        // 2. 신규 생성된 상품 비활성화
        if (createdProductIds.length > 0) {
          await tx.product.updateMany({
            where: { id: { in: createdProductIds } },
            data: {
              isActive: false,
              deactivatedAt: new Date(),
              deactivatedReason: "ROLLBACK",
            },
          });
        }

        // 3. 업데이트된 상품 원복
        for (const [productId, before] of Object.entries(beforeStates)) {
          await tx.product.update({
            where: { id: productId },
            data: {
              name: before.name as string,
              sellPrice: before.sellPrice as number,
              supplyPrice: before.supplyPrice as number,
              originalPrice: (before.originalPrice as number) || null,
              category: (before.category as string) || null,
              totalStock: before.totalStock as number,
              stockMujin: before.stockMujin as number,
              notes: (before.notes as string) || null,
              isActive: before.isActive as boolean,
              deactivatedAt: before.isActive ? null : new Date(),
              deactivatedReason: before.isActive ? null : "EXCEL_UPLOAD",
            },
          });
        }
      },
      { timeout: 30000 }
    );

    // AuditLog
    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: "RESTORE",
      entityType: "Product",
      entityId: centerId,
      entityName: `엑셀 업로드 롤백`,
      description: `업로드 롤백: 복원 ${deactivatedProductIds.length}, 비활성화 ${createdProductIds.length}, 원복 ${Object.keys(beforeStates).length}`,
      metadata: { rolledBackAuditLogId: auditLogId, centerId },
      request: req,
    });

    return ok({
      message: "롤백 완료",
      restored: deactivatedProductIds.length,
      deactivated: createdProductIds.length,
      reverted: Object.keys(beforeStates).length,
    });
  }
);
