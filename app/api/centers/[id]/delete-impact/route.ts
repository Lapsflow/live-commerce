import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/centers/:id/delete-impact
 *
 * 센터 hard delete 시 cascade/setNull 영향도 조회
 * PDF §9 의무 — 비활성화 vs 삭제 결정 전 영향 표시
 * 권한: MASTER
 *
 * Center 관계 (prisma/schema.prisma):
 *   - ProductCenterStock.centerId  →  Cascade (재고 매핑 함께 삭제)
 *   - User.centerId                →  SetNull (사용자만 null, 계정 유지)
 *   - Order.processingCenterId     →  SetNull (발주 이력 유지)
 *   - Broadcast.centerId           →  SetNull (방송 이력 유지)
 *   - ScanLog.centerId             →  SetNull (스캔 이력 유지)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }
    if (session.user.role !== "MASTER") {
      return errors.forbidden("센터 삭제 영향 조회는 MASTER 권한이 필요합니다");
    }

    const { id } = await params;
    if (!id) {
      return errors.badRequest("Center ID가 필요합니다");
    }

    const center = await prisma.center.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });
    if (!center) {
      return errors.notFound("센터를 찾을 수 없습니다");
    }

    // Cascade: 함께 영구 삭제될 항목
    const [productStockCount] = await Promise.all([
      prisma.productCenterStock.count({ where: { centerId: id } }),
    ]);

    // SetNull: 이력 보존 (참조만 null)
    const [userCount, orderCount, broadcastCount, scanLogCount] =
      await Promise.all([
        prisma.user.count({ where: { centerId: id } }),
        prisma.order.count({ where: { processingCenterId: id } }),
        prisma.broadcast.count({ where: { centerId: id } }),
        prisma.scanLog.count({ where: { centerId: id } }),
      ]);

    return ok({
      cascade: {
        productCenterStocks: productStockCount,
      },
      setNull: {
        users: userCount,
        orders: orderCount,
        broadcasts: broadcastCount,
        scanLogs: scanLogCount,
      },
      total: {
        willDelete: productStockCount,
        willPreserve: userCount + orderCount + broadcastCount + scanLogCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "영향도 조회 실패";
    console.error("[CENTER DELETE-IMPACT] error:", err);
    return errors.internal(message);
  }
}
