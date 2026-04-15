import { NextRequest } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

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

      return scanLog;
    });

    // Fetch updated stock
    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        centerStocks: {
          where: centerId ? { centerId } : undefined,
          include: {
            center: {
              select: {
                code: true,
                name: true,
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
      updatedStock: updatedProduct?.centerStocks[0]?.stock ?? null,
      scannedAt: result.scannedAt,
    });
  }
);
