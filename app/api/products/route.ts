import { NextRequest } from "next/server";
import { withRole, AuthUser } from "@/lib/api/middleware";
import { ok, errors, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
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
export const GET = withRole(["MASTER", "ADMIN", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const productType = searchParams.get("productType") as "HEADQUARTERS" | "CENTER" | null;
  const search = searchParams.get("search");
  const pageIndex = Math.max(0, parseInt(searchParams.get("pageIndex") || "0"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));

  const where: Record<string, unknown> = {};

  // Filter by productType if specified
  if (productType) {
    where.productType = productType;
  }

  // Filter by search (code, name, barcode)
  const searchFilter = search ? {
    OR: [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ],
  } : {};

  // Authorization: SELLER can only see CENTER products from their center
  const authFilter = user.role === "SELLER" ? {
    productType: "CENTER",
    managedBy: user.centerId,
  } : {};

  // Combine filters with AND
  const andFilters = [searchFilter, authFilter].filter(f => Object.keys(f).length > 0);
  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: pageSize,
      skip: pageIndex * pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

  return paginated(products, total, pageSize);
});

// POST: Create product with type validation
export const POST = withRole(["MASTER", "ADMIN", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  const body = await req.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return errors.badRequest(parsed.error.issues[0].message, parsed.error.issues);
  }

  const data = parsed.data;

  // Default productType to HEADQUARTERS
  const productType = data.productType || "HEADQUARTERS";

  // Phase 2: Authorization check
  if (user.role === "SELLER") {
    // SELLER can only create CENTER products
    if (productType === "HEADQUARTERS") {
      return errors.forbidden("판매자는 본사(WMS) 상품을 생성할 수 없습니다. 센터 자사몰 상품만 생성 가능합니다.");
    }
    // SELLER can only create products for their own center
    if (!user.centerId) {
      return errors.forbidden("센터가 배정되지 않았습니다.");
    }
  }

  // Phase 2: Product type validation
  if (productType === "HEADQUARTERS") {
    // WMS products: barcode required
    if (!data.barcode) {
      return errors.badRequest("본사(WMS) 상품은 바코드가 필수입니다.");
    }
  } else if (productType === "CENTER") {
    // CENTER products: managedBy required
    const managedBy = user.role === "SELLER"
      ? user.centerId
      : data.managedBy;

    if (!managedBy) {
      return errors.badRequest("센터 자사몰 상품은 관리 센터(managedBy)가 필수입니다.");
    }

    // Verify center exists
    const center = await prisma.center.findUnique({
      where: { id: managedBy },
    });

    if (!center) {
      return errors.badRequest("존재하지 않는 센터입니다.");
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
        ? (user.role === "SELLER" ? user.centerId : data.managedBy)
        : null,
      isWmsProduct: productType === "HEADQUARTERS",
    },
  });

  return ok(product);
});
