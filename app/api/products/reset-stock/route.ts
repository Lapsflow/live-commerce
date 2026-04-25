/**
 * POST /api/products/reset-stock
 * Reset all center stock to 0 for a specific center
 * PDF p9: 센터 필수 기능 — 상품등록, 재고수정, 초기화, 엑셀업로드
 */

import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const body = await req.json();
      const { centerId } = body;

      if (!centerId) {
        return errors.badRequest("centerId가 필요합니다");
      }

      // ADMIN/SUB_MASTER can only reset their own center
      if (user.role !== "MASTER" && user.centerId !== centerId) {
        return errors.forbidden("해당 센터의 재고를 초기화할 권한이 없습니다");
      }

      // Verify center exists
      const center = await prisma.center.findUnique({
        where: { id: centerId },
        select: { id: true, name: true, code: true },
      });

      if (!center) {
        return errors.notFound("Center");
      }

      // Reset all stock to 0 for this center
      const result = await prisma.productCenterStock.updateMany({
        where: { centerId },
        data: { stock: 0 },
      });

      return ok({
        centerId,
        centerName: center.name,
        centerCode: center.code,
        resetCount: result.count,
        message: `${center.name} 센터의 재고 ${result.count}건이 초기화되었습니다`,
      });
    } catch (error) {
      console.error("Failed to reset stock:", error);
      return errors.internal("재고 초기화 중 오류가 발생했습니다");
    }
  }
);
