import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { serializeProduct } from "@/lib/services/products/serializeProduct";
import { logAudit } from "@/lib/services/audit";

// Phase 2: Product Update Schema (partial)
const productUpdateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  barcode: z.string().min(1).max(50).optional(),
  sellPrice: z.number().int().min(0).optional(),
  supplyPrice: z.number().int().min(0).optional(),
  originalPrice: z.number().int().min(0).optional(),
  totalStock: z.number().int().min(0).optional(),
  stockMujin: z.number().int().min(0).optional(),
  stock1: z.number().int().min(0).optional(),
  stock2: z.number().int().min(0).optional(),
  stock3: z.number().int().min(0).optional(),
  productType: z.enum(["HEADQUARTERS", "CENTER"]).optional(),
  managedBy: z.string().optional(),
  isActive: z.boolean().optional(),
  category: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// GET: Get single product
// Phase 2: withRole() middleware applied
export const GET = withRole(["MASTER", "SUB_MASTER", "ADMIN", "SELLER"], async (
  req: NextRequest,
  user: AuthUser,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {

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
    // Note: user.centerId comes from session (auth.ts includes centerId)
    const session = await auth();
    const centerId = session?.user?.centerId;

    if (user.role === "SELLER") {
      if (
        product.productType !== "CENTER" ||
        product.managedBy !== centerId
      ) {
        return error("FORBIDDEN", "권한이 없습니다.", 403);
      }
    }

    return ok(serializeProduct(product, user.role));
  } catch (err: any) {
    console.error("[PRODUCT GET ERROR]", err);
    return error("FETCH_FAILED", err.message, 500);
  }
});

// PUT: Update product
// Phase 2: withRole() middleware applied
export const PUT = withRole(["MASTER", "SUB_MASTER", "ADMIN", "SELLER"], async (
  req: NextRequest,
  user: AuthUser,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
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

    // Get centerId from session for SELLER authorization
    const session = await auth();
    const centerId = session?.user?.centerId;

    // Phase 2: Authorization check
    if (user.role === "SELLER") {
      // SELLER can only edit CENTER products from their center
      if (existingProduct.productType === "HEADQUARTERS") {
        return error(
          "FORBIDDEN",
          "판매자는 본사(WMS) 상품을 수정할 수 없습니다.",
          403
        );
      }
      if (existingProduct.managedBy !== centerId) {
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

    // Phase 2: WMS products have read-only pricing (API-level enforcement)
    if (existingProduct.productType === "HEADQUARTERS") {
      // Block price changes for WMS products
      if (data.sellPrice !== undefined || data.supplyPrice !== undefined) {
        return error(
          "FORBIDDEN",
          "본사(WMS) 상품은 가격을 수정할 수 없습니다.",
          403
        );
      }
    } else {
      // CENTER products: allow price updates
      if (data.sellPrice !== undefined) updateData.sellPrice = data.sellPrice;
      if (data.supplyPrice !== undefined) updateData.supplyPrice = data.supplyPrice;
    }

    if (data.totalStock !== undefined) updateData.totalStock = data.totalStock;
    if (data.stockMujin !== undefined) updateData.stockMujin = data.stockMujin;
    if (data.stock1 !== undefined) updateData.stock1 = data.stock1;
    if (data.stock2 !== undefined) updateData.stock2 = data.stock2;
    if (data.stock3 !== undefined) updateData.stock3 = data.stock3;

    // Only ADMIN can change productType
    if (data.productType && user.role !== "SELLER") {
      updateData.productType = data.productType;
      updateData.isWmsProduct = data.productType === "HEADQUARTERS";
    }

    // Only ADMIN can change managedBy
    if (data.managedBy && user.role !== "SELLER") {
      updateData.managedBy = data.managedBy;
    }

    // PRODUCT-05: isActive (MASTER/SUB_MASTER/ADMIN only, SELLER cannot reactivate)
    if (data.isActive !== undefined && user.role !== "SELLER") {
      updateData.isActive = data.isActive;
    }

    // CENTER product: allow originalPrice, category, notes updates
    if (data.originalPrice !== undefined && user.role === "MASTER") {
      updateData.originalPrice = data.originalPrice;
    }
    if (data.category !== undefined) updateData.category = data.category;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // AuditLog
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(updateData)) {
      const oldVal = (existingProduct as any)[key];
      const newVal = (updateData as any)[key];
      if (oldVal !== newVal) {
        changes[key] = { from: oldVal, to: newVal };
      }
    }
    if (Object.keys(changes).length > 0) {
      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "UPDATE",
        entityType: "Product",
        entityId: product.id,
        entityName: product.name,
        before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
        after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
        description: `상품 수정: ${product.name} (${product.code})`,
        request: req,
      });
    }

    return ok(product);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[PRODUCT UPDATE ERROR]", err);
    return error("UPDATE_FAILED", err.message, 500);
  }
});

// DELETE: Soft-delete product (비활성화 — PRODUCT-05 정책: hard delete 금지)
export const DELETE = withRole(["MASTER", "SUB_MASTER", "ADMIN"], async (
  req: NextRequest,
  user: AuthUser,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    // 사유 파싱 (body가 있는 경우)
    let reason = "";
    try {
      const body = await req.json();
      reason = body?.reason || "";
    } catch {
      // body가 없는 경우 무시
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return error("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
    }

    // SUB_MASTER/ADMIN: 본인 센터 상품만 비활성화 가능
    if (user.role === "SUB_MASTER" || user.role === "ADMIN") {
      if (product.productType === "CENTER" && product.managedBy !== user.centerId) {
        return error("FORBIDDEN", "다른 센터의 상품은 비활성화할 수 없습니다.", 403);
      }
      // HQ 상품은 MASTER만 비활성화 가능
      if (product.productType === "HEADQUARTERS") {
        return error("FORBIDDEN", "본사 상품은 전체관리자만 비활성화할 수 있습니다.", 403);
      }
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: "UPDATE",
      entityType: "Product",
      entityId: product.id,
      entityName: product.name,
      before: { isActive: true },
      after: { isActive: false },
      description: `상품 비활성화: ${product.name} (${product.code})${reason ? ` — 사유: ${reason}` : ""}`,
      request: req,
    });

    return ok({ message: "상품이 비활성화되었습니다." });
  } catch (err: any) {
    console.error("[PRODUCT DELETE ERROR]", err);
    return error("DELETE_FAILED", err.message, 500);
  }
});
