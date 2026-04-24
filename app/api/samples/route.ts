import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/samples
 * 샘플 쇼핑몰 상품 목록 (isSample=true만)
 * 쿼리: ?category=FOOD&priceType=free|paid&status=CONTINUOUS&search=키워드&sort=latest|price
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest) => {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const priceType = url.searchParams.get("priceType"); // free | paid
    const status = url.searchParams.get("status"); // CONTINUOUS | UNTIL_SOLD
    const search = url.searchParams.get("search");
    const sort = url.searchParams.get("sort") || "latest"; // latest | price

    const where: any = {
      isSample: true,
    };

    if (category) {
      where.sampleCategory = category;
    }

    if (priceType === "free") {
      where.samplePrice = 0;
    } else if (priceType === "paid") {
      where.samplePrice = { gt: 0 };
    }

    if (status) {
      where.sampleStatus = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    // 소진후 종료 상품: 재고 0이면 제외
    // (표시는 하되 "품절" 표시)

    const orderBy =
      sort === "price"
        ? { samplePrice: "asc" as const }
        : { createdAt: "desc" as const };

    const products = await prisma.product.findMany({
      where,
      orderBy,
      take: 100,
      select: {
        id: true,
        code: true,
        name: true,
        barcode: true,
        sellPrice: true,
        totalStock: true,
        productType: true,
        isSample: true,
        sampleCategory: true,
        samplePrice: true,
        sampleStatus: true,
      },
    });

    return ok(products);
  }
);

/**
 * PUT /api/samples
 * 상품을 샘플로 지정/해제 (MASTER, SUB_MASTER만)
 * Body: { productId, isSample, sampleCategory?, samplePrice?, sampleStatus? }
 */
export const PUT = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    const body = await req.json();
    const { productId, isSample, sampleCategory, samplePrice, sampleStatus } = body;

    if (!productId) {
      return errors.badRequest("productId가 필요합니다");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return errors.notFound("상품");
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        isSample: isSample ?? product.isSample,
        sampleCategory: isSample === false ? null : (sampleCategory ?? product.sampleCategory),
        samplePrice: isSample === false ? null : (samplePrice ?? product.samplePrice),
        sampleStatus: isSample === false ? null : (sampleStatus ?? product.sampleStatus),
      },
    });

    return ok(updated);
  }
);
