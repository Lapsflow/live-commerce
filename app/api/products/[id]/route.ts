import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Phase 2: Product Update Schema (partial)
const productUpdateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  barcode: z.string().min(1).max(50).optional(),
  sellPrice: z.number().int().min(0).optional(),
  supplyPrice: z.number().int().min(0).optional(),
  totalStock: z.number().int().min(0).optional(),
  stockMujin: z.number().int().min(0).optional(),
  stock1: z.number().int().min(0).optional(),
  stock2: z.number().int().min(0).optional(),
  stock3: z.number().int().min(0).optional(),
  productType: z.enum(["HEADQUARTERS", "CENTER"]).optional(),
  managedBy: z.string().optional(),
});

// GET: Get single product
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        centerStocks: {
          include: {
            center: true,
          },
        },
      },
    });

    if (!product) {
      return error("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
    }

    // Authorization: SELLER can only view CENTER products from their center
    if (session.user.role === "SELLER") {
      if (
        product.productType !== "CENTER" ||
        product.managedBy !== session.user.centerId
      ) {
        return error("FORBIDDEN", "권한이 없습니다.", 403);
      }
    }

    return ok(product);
  } catch (err: any) {
    console.error("[PRODUCT GET ERROR]", err);
    return error("FETCH_FAILED", err.message, 500);
  }
}

// PUT: Update product
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const { id } = await params;
    const body = await req.json();
    const data = productUpdateSchema.parse(body);

    // Find existing product
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return error("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
    }

    // Phase 2: Authorization check
    if (session.user.role === "SELLER") {
      // SELLER can only edit CENTER products from their center
      if (existingProduct.productType === "HEADQUARTERS") {
        return error(
          "FORBIDDEN",
          "판매자는 본사(WMS) 상품을 수정할 수 없습니다.",
          403
        );
      }
      if (existingProduct.managedBy !== session.user.centerId) {
        return error("FORBIDDEN", "다른 센터의 상품은 수정할 수 없습니다.", 403);
      }
      // SELLER cannot change productType
      if (data.productType && data.productType !== existingProduct.productType) {
        return error("FORBIDDEN", "상품 유형은 변경할 수 없습니다.", 403);
      }
    }

    // Phase 2: Product type validation
    const newProductType = data.productType || existingProduct.productType;

    if (newProductType === "HEADQUARTERS") {
      // WMS products: barcode required
      const newBarcode = data.barcode || existingProduct.barcode;
      if (!newBarcode) {
        return error(
          "VALIDATION_ERROR",
          "본사(WMS) 상품은 바코드가 필수입니다.",
          400
        );
      }
    }

    // Update product
    const updateData: any = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.sellPrice !== undefined) updateData.sellPrice = data.sellPrice;
    if (data.supplyPrice !== undefined) updateData.supplyPrice = data.supplyPrice;
    if (data.totalStock !== undefined) updateData.totalStock = data.totalStock;
    if (data.stockMujin !== undefined) updateData.stockMujin = data.stockMujin;
    if (data.stock1 !== undefined) updateData.stock1 = data.stock1;
    if (data.stock2 !== undefined) updateData.stock2 = data.stock2;
    if (data.stock3 !== undefined) updateData.stock3 = data.stock3;

    // Only ADMIN can change productType
    if (data.productType && session.user.role !== "SELLER") {
      updateData.productType = data.productType;
      updateData.isWmsProduct = data.productType === "HEADQUARTERS";
    }

    // Only ADMIN can change managedBy
    if (data.managedBy && session.user.role !== "SELLER") {
      updateData.managedBy = data.managedBy;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return ok(product);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[PRODUCT UPDATE ERROR]", err);
    return error("UPDATE_FAILED", err.message, 500);
  }
}

// DELETE: Delete product
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    // Only ADMIN can delete products
    if (session.user.role === "SELLER") {
      return error("FORBIDDEN", "판매자는 상품을 삭제할 수 없습니다.", 403);
    }

    const { id } = await params;

    await prisma.product.delete({
      where: { id },
    });

    return ok({ message: "상품이 삭제되었습니다." });
  } catch (err: any) {
    console.error("[PRODUCT DELETE ERROR]", err);
    return error("DELETE_FAILED", err.message, 500);
  }
}
