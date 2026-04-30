import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { createOnewmsClient } from "@/lib/onewms";
import { serializeProduct } from "@/lib/services/products/serializeProduct";
import { canProductBeBroadcast } from "@/lib/services/products/canBroadcast";
import { getActiveCenterIdForSeller } from "@/lib/services/broadcasts";

type Params = Promise<{ code: string }>;

/**
 * GET /api/products/barcode/[code]
 * 바코드로 상품 조회 + ONEWMS 실시간 재고
 */
export const GET = withRole(
  ["SELLER", "ADMIN", "SUB_MASTER", "MASTER"],
  async (request: NextRequest, user, context: { params: Params }) => {
    const params = await context.params;
    const { code } = params;

    if (!code) {
      return errors.badRequest("Barcode is required");
    }

    // 1. 로컬 DB 상품 조회
    const product = await prisma.product.findUnique({
      where: { barcode: code },
      include: {
        centerStocks: {
          include: {
            center: {
              select: {
                id: true,
                code: true,
                name: true,
                regionName: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return errors.notFound("Product");
    }

    // 가격 0원 상품: 셀러는 차단, 마스터/관리자는 경고 포함 통과
    const broadcastEligible = canProductBeBroadcast(product);
    if (!broadcastEligible && user.role === "SELLER") {
      return errors.badRequest("이 상품은 아직 가격이 설정되지 않아 방송할 수 없습니다");
    }

    // B-6: 센터 상품 접근 권한 체크 (셀러만)
    // CENTER 상품은 셀러의 활성 방송 센터와 일치할 때만 접근 가능
    if (user.role === "SELLER" && product.productType === "CENTER" && product.managedBy) {
      const activeCenterId = await getActiveCenterIdForSeller(user.userId);
      if (!activeCenterId) {
        return errors.forbidden("활성 방송이 없어 센터 상품에 접근할 수 없습니다");
      }
      if (activeCenterId !== product.managedBy) {
        return errors.forbidden("현재 방송 센터와 다른 센터의 상품에는 접근할 수 없습니다");
      }
    }

    // 2. ONEWMS 실시간 재고 조회 (onewmsCode 있을 때만)
    let realtimeStock: number | null = null;
    let stockError: string | null = null;
    let lastSyncedAt: string | null = null;
    const cachedStock = product.totalStock;

    if (product.onewmsCode) {
      const startTime = Date.now();
      try {
        const client = createOnewmsClient();
        const stockData = await client.getStockInfo("barcode", code);

        // ONEWMS 응답: { [product_id]: { stock: { [wh_seq]: { stock } } } }
        let totalWmsStock = 0;
        for (const entry of Object.values(stockData)) {
          if (entry?.stock && typeof entry.stock === "object") {
            for (const wh of Object.values(entry.stock)) {
              totalWmsStock += Number(wh.stock) || 0;
            }
          }
        }

        realtimeStock = totalWmsStock;
        lastSyncedAt = new Date().toISOString();

        // 로컬 DB totalStock 업데이트
        if (totalWmsStock !== cachedStock) {
          await prisma.product.update({
            where: { id: product.id },
            data: { totalStock: totalWmsStock },
          });
        }

        const elapsed = Date.now() - startTime;
        console.log(
          JSON.stringify({
            event: "ONEWMS_STOCK_QUERY",
            barcode: code,
            productId: product.id,
            realtimeStock: totalWmsStock,
            cachedStock,
            diff: totalWmsStock - cachedStock,
            elapsed_ms: elapsed,
            status: "success",
          })
        );
      } catch (err: unknown) {
        const elapsed = Date.now() - startTime;
        const message =
          err instanceof Error ? err.message : "ONEWMS 연결 실패";
        stockError = message;

        console.error(
          JSON.stringify({
            event: "ONEWMS_STOCK_QUERY",
            barcode: code,
            productId: product.id,
            error: message,
            elapsed_ms: elapsed,
            status: "failed",
          })
        );
      }
    }

    // 3. 응답 구조화
    const response = {
      id: product.id,
      code: product.code,
      name: product.name,
      barcode: product.barcode,
      sellPrice: product.sellPrice,
      supplyPrice: product.supplyPrice,
      originalPrice: product.originalPrice,
      minSellPrice: product.minSellPrice,
      maxSellPrice: product.maxSellPrice,
      totalStock: realtimeStock ?? cachedStock,
      centerStocks: product.centerStocks.map((stock) => ({
        centerId: stock.centerId,
        centerCode: stock.center.code,
        centerName: stock.center.name,
        regionName: stock.center.regionName,
        stock: stock.stock,
        location: stock.location,
      })),
      realtimeStock,
      cachedStock,
      stockError,
      lastSyncedAt,
      broadcastEligible,
      priceWarning: !broadcastEligible ? "가격이 설정되지 않은 상품입니다. 가격 설정 후 방송에 사용할 수 있습니다." : null,
    };

    return ok(serializeProduct(response, user.role));
  }
);
