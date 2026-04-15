import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/inventory/scan-history
 * 사용자의 스캔 이력 조회
 */
export const GET = withRole(
  ["SELLER", "ADMIN", "SUB_MASTER", "MASTER"],
  async (request: NextRequest, user) => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const scanType = searchParams.get("scanType");
    const centerId = searchParams.get("centerId");

    // Fetch scan history
    const scanLogs = await prisma.scanLog.findMany({
      where: {
        userId: user.userId,
        ...(scanType && { scanType: scanType as any }),
        ...(centerId && { centerId }),
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
        center: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        scannedAt: "desc",
      },
      take: limit,
    });

    const formattedHistory = scanLogs.map((log) => ({
      id: log.id,
      barcode: log.barcode,
      productName: log.product?.name ?? null,
      scanType: log.scanType,
      quantity: log.quantity,
      centerId: log.centerId,
      centerName: log.center?.name ?? null,
      scannedAt: log.scannedAt.toISOString(),
    }));

    return ok(formattedHistory);
  }
);
