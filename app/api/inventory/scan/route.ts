import { NextRequest } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { syncProductStock } from "@/lib/services/onewms/stockSync";

const scanSchema = z.object({
  barcode: z.string().min(1),
  scanType: z.enum(["INBOUND", "OUTBOUND", "LOOKUP"]),
  quantity: z.number().int().positive().optional(),
  centerId: z.string().optional(),
});

/**
 * POST /api/inventory/scan
 * 바코드 스캔 이벤트 기록 + 재고 업데이트
 */
export const POST = withRole(
  ["SELLER", "ADMIN", "SUB_MASTER", "MASTER"],
  async (request: NextRequest, user) => {
    const body = await request.json();

    // Zod validation
    const validation = scanSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest("Invalid request data", validation.error.format());
    }

    const { barcode, scanType, quantity, centerId } = validation.data;

    // Additional validation for INBOUND/OUTBOUND
    if (scanType !== "LOOKUP" && (!quantity || !centerId)) {
      return errors.badRequest("Quantity and centerId are required for INBOUND/OUTBOUND");
    }

    // Find product
    const product = await prisma.product.findUnique({
      where: { barcode },
    });

    // Create scan log even if product not found (audit trail for all modes)
    if (!product) {
      await prisma.scanLog.create({
        data: {
          userId: user.userId,
          productId: null,
          barcode,
          scanType,
          quantity: scanType === "LOOKUP" ? null : quantity,
          centerId: scanType === "LOOKUP" ? null : centerId,
          metadata: {
            userName: user.name,
            userRole: user.role,
            notFound: true,
          },
        },
      });

      return errors.notFound("Product");
    }

    // Fetch previous stock before update
    let previousStock: number | null = null;
    if (scanType !== "LOOKUP" && centerId) {
      const existingStock = await prisma.productCenterStock.findUnique({
        where: {
          productId_centerId: {
            productId: product.id,
            centerId,
          },
        },
      });
      previousStock = existingStock?.stock ?? null;
    }

    // Transaction: Create scan log + Update stock
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create scan log
      const scanLog = await tx.scanLog.create({
        data: {
          userId: user.userId,
          productId: product.id,
          barcode,
          scanType,
          quantity: scanType === "LOOKUP" ? null : quantity,
          centerId: scanType === "LOOKUP" ? null : centerId,
          metadata: {
            userName: user.name,
            userRole: user.role,
          },
        },
      });

      // 2. Update stock if INBOUND or OUTBOUND
      if (scanType !== "LOOKUP" && centerId) {
        // Find or create ProductCenterStock
        const existingStock = await tx.productCenterStock.findUnique({
          where: {
            productId_centerId: {
              productId: product.id,
              centerId,
            },
          },
        });

        if (existingStock) {
          // Update existing stock
          const newStock =
            scanType === "INBOUND"
              ? existingStock.stock + (quantity ?? 0)
              : existingStock.stock - (quantity ?? 0);

          if (newStock < 0) {
            throw new Error("재고가 부족합니다");
          }

          await tx.productCenterStock.update({
            where: {
              productId_centerId: {
                productId: product.id,
                centerId,
              },
            },
            data: { stock: newStock },
          });
        } else {
          // Create new stock record (only for INBOUND)
          if (scanType === "INBOUND" && quantity) {
            await tx.productCenterStock.create({
              data: {
                productId: product.id,
                centerId,
                stock: quantity,
              },
            });
          } else {
            throw new Error("해당 센터에 재고가 없습니다");
          }
        }
      }

      // 3. Recalculate Product.totalStock from all center stocks
      if (scanType !== "LOOKUP") {
        const allStocks = await tx.productCenterStock.findMany({
          where: { productId: product.id },
        });
        const newTotalStock = allStocks.reduce((sum, s) => sum + s.stock, 0);
        await tx.product.update({
          where: { id: product.id },
          data: { totalStock: newTotalStock },
        });
      }

      return scanLog;
    });

    // LOOKUP 모드에서도 totalStock 정합성 체크 + 자동 보정
    if (scanType === "LOOKUP") {
      const allStocks = await prisma.productCenterStock.findMany({
        where: { productId: product.id },
      });
      const calculatedTotal = allStocks.reduce((sum, s) => sum + s.stock, 0);
      if (calculatedTotal !== product.totalStock) {
        await prisma.product.update({
          where: { id: product.id },
          data: { totalStock: calculatedTotal },
        });
      }
    }

    // ONEWMS 실시간 동기화 (비동기, 논블로킹)
    let wmsSyncStatus: "triggered" | "skipped" | "no_wms_code" = "skipped";
    if (scanType !== "LOOKUP" && product.onewmsCode) {
      wmsSyncStatus = "triggered";
      syncProductStock(product.id).catch((err) =>
        console.error("[Scan] ONEWMS sync failed (non-blocking):", err)
      );
    } else if (scanType !== "LOOKUP" && !product.onewmsCode) {
      wmsSyncStatus = "no_wms_code";
    }

    // Fetch updated product with all center stocks
    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        centerStocks: {
          include: {
            center: {
              select: {
                code: true,
                name: true,
                regionName: true,
              },
            },
          },
        },
      },
    });

    return ok({
      scanLogId: result.id,
      productId: product.id,
      previousStock,
      updatedStock: updatedProduct?.centerStocks.find(s => s.centerId === centerId)?.stock ?? null,
      totalStock: updatedProduct?.totalStock ?? product.totalStock,
      wmsSync: wmsSyncStatus,
      product: updatedProduct ? {
        id: updatedProduct.id,
        code: updatedProduct.code,
        name: updatedProduct.name,
        barcode: updatedProduct.barcode,
        sellPrice: updatedProduct.sellPrice,
        supplyPrice: updatedProduct.supplyPrice,
        minSellPrice: updatedProduct.minSellPrice,
        maxSellPrice: updatedProduct.maxSellPrice,
        totalStock: updatedProduct.totalStock,
        centerStocks: updatedProduct.centerStocks.map(cs => ({
          centerId: cs.centerId,
          centerCode: cs.center.code,
          centerName: cs.center.name,
          regionName: cs.center.regionName,
          stock: cs.stock,
          location: cs.location,
        })),
      } : null,
      scannedAt: result.scannedAt,
    });
  }
);
