import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

type Params = Promise<{ code: string }>;

/**
 * GET /api/products/barcode/[code]
 * 바코드로 상품 조회 + 센터별 재고 정보
 */
export const GET = withRole(
  ["SELLER", "ADMIN", "SUB_MASTER", "MASTER"],
  async (request: NextRequest, user, context: { params: Params }) => {
    const params = await context.params;
    const { code } = params;

    if (!code) {
      return errors.badRequest("Barcode is required");
    }

    // 바코드로 상품 조회
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

    // 응답 데이터 구조화
    const response = {
      id: product.id,
      code: product.code,
      name: product.name,
      barcode: product.barcode,
      sellPrice: product.sellPrice,
      supplyPrice: product.supplyPrice,
      totalStock: product.totalStock,
      centerStocks: product.centerStocks.map((stock) => ({
        centerId: stock.centerId,
        centerCode: stock.center.code,
        centerName: stock.center.name,
        regionName: stock.center.regionName,
        stock: stock.stock,
        location: stock.location,
      })),
    };

    return ok(response);
  }
);
