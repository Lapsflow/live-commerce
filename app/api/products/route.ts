import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Phase 2: Product Type Validation Schema
const productSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  barcode: z.string().min(1).max(50).optional(), // Optional for CENTER products
  sellPrice: z.number().int().min(0),
  supplyPrice: z.number().int().min(0),
  totalStock: z.number().int().min(0).optional(),
  stockMujin: z.number().int().min(0).optional(),
  stock1: z.number().int().min(0).optional(),
  stock2: z.number().int().min(0).optional(),
  stock3: z.number().int().min(0).optional(),
  productType: z.enum(["HEADQUARTERS", "CENTER"]).optional(), // Default: HEADQUARTERS
  managedBy: z.string().optional(), // centerId for CENTER products
});

// GET: List products with filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const { searchParams } = new URL(req.url);
    const productType = searchParams.get("productType") as "HEADQUARTERS" | "CENTER" | null;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};

    // Filter by productType if specified
    if (productType) {
      where.productType = productType;
    }

    // Filter by search (code, name, barcode)
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    // Authorization: SELLER can only see CENTER products from their center
    if (session.user.role === "SELLER") {
      where.OR = [
        { productType: "CENTER", managedBy: session.user.centerId },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    return ok({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("[PRODUCTS GET ERROR]", err);
    return error("FETCH_FAILED", err.message, 500);
  }
}

// POST: Create product with type validation
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const body = await req.json();
    const data = productSchema.parse(body);

    // Default productType to HEADQUARTERS
    const productType = data.productType || "HEADQUARTERS";

    // Phase 2: Authorization check
    if (session.user.role === "SELLER") {
      // SELLER can only create CENTER products
      if (productType === "HEADQUARTERS") {
        return error(
          "FORBIDDEN",
          "판매자는 본사(WMS) 상품을 생성할 수 없습니다. 센터 자사몰 상품만 생성 가능합니다.",
          403
        );
      }
      // SELLER can only create products for their own center
      if (!session.user.centerId) {
        return error("FORBIDDEN", "센터가 배정되지 않았습니다.", 403);
      }
    }

    // Phase 2: Product type validation
    if (productType === "HEADQUARTERS") {
      // WMS products: barcode required
      if (!data.barcode) {
        return error(
          "VALIDATION_ERROR",
          "본사(WMS) 상품은 바코드가 필수입니다.",
          400
        );
      }
    } else if (productType === "CENTER") {
      // CENTER products: managedBy required
      const managedBy = session.user.role === "SELLER"
        ? session.user.centerId
        : data.managedBy;

      if (!managedBy) {
        return error(
          "VALIDATION_ERROR",
          "센터 자사몰 상품은 관리 센터(managedBy)가 필수입니다.",
          400
        );
      }

      // Verify center exists
      const center = await prisma.center.findUnique({
        where: { id: managedBy },
      });

      if (!center) {
        return error("VALIDATION_ERROR", "존재하지 않는 센터입니다.", 400);
      }
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        barcode: data.barcode || "", // Empty string if not provided
        sellPrice: data.sellPrice,
        supplyPrice: data.supplyPrice,
        totalStock: data.totalStock || 0,
        stockMujin: data.stockMujin || 0,
        stock1: data.stock1 || 0,
        stock2: data.stock2 || 0,
        stock3: data.stock3 || 0,
        productType,
        managedBy: productType === "CENTER"
          ? (session.user.role === "SELLER" ? session.user.centerId : data.managedBy)
          : null,
        isWmsProduct: productType === "HEADQUARTERS",
      },
    });

    return ok(product);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[PRODUCT CREATE ERROR]", err);
    return error("CREATE_FAILED", err.message, 500);
  }
}
