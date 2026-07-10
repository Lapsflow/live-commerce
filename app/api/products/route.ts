import { NextRequest } from "next/server";
import { withRole, AuthUser } from "@/lib/api/middleware";
import { ok, errors, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { validateProductCode } from "@/lib/validators/product";
import { logAudit } from "@/lib/services/audit";
import { serializeProducts } from "@/lib/services/products/serializeProduct";
import { generateCenterProductCode } from "@/lib/services/products/codeGenerator";

// Phase 2: Product Type Validation Schema
const productSchema = z.object({
  code: z.string().max(50).optional(), // Optional for CENTER (auto-generated)
  name: z.string().min(1).max(200),
  barcode: z.string().min(1).max(50).optional(), // Optional for CENTER products
  sellPrice: z.number().int().min(0),
  supplyPrice: z.number().int().min(0),
  originalPrice: z.number().int().min(0).optional(),
  totalStock: z.number().int().min(0).optional(),
  stockMujin: z.number().int().min(0).optional(),
  stock1: z.number().int().min(0).optional(),
  stock2: z.number().int().min(0).optional(),
  stock3: z.number().int().min(0).optional(),
  productType: z.enum(["HEADQUARTERS", "CENTER"]).optional(), // Default: HEADQUARTERS
  managedBy: z.string().optional(), // centerId for CENTER products
  category: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

// GET: List products with filters
export const GET = withRole(["MASTER", "SUB_MASTER", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const productType = searchParams.get("productType") as "HEADQUARTERS" | "CENTER" | null;
  const search = searchParams.get("search");
  const showInactive = searchParams.get("showInactive") === "true";
  const pageIndex = Math.max(0, parseInt(searchParams.get("pageIndex") || "0"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));

  const where: Record<string, unknown> = {};

  // PRODUCT-05: 기본적으로 활성 상품만 조회, showInactive=true 시 전체
  if (!showInactive) {
    where.isActive = true;
  }

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

  // Authorization filters by role
  let authFilter: Record<string, unknown> = {};
  if (user.role === "SELLER") {
    // 셀러: 본인 센터 CENTER 상품만 (가격 0원 제외)
    // B-7: centerId 없는 셀러는 상품 접근 불가 (프라이버시 보호)
    if (!user.centerId) {
      // pageSize 0 이면 pageCount = ceil(0/0) = NaN 이 프론트로 내려감 (2026-07-10 수정)
      return paginated([], 0, pageSize);
    }
    authFilter = {
      productType: "CENTER",
      managedBy: user.centerId,
      sellPrice: { gt: 0 },
      supplyPrice: { gt: 0 },
    };
  } else if (user.role === "SUB_MASTER") {
    // SUB_MASTER: 본사 상품 + 본인 센터 상품
    if (user.centerId) {
      authFilter = {
        OR: [
          { productType: "HEADQUARTERS" },
          { productType: "CENTER", managedBy: user.centerId },
        ],
      };
    }
  }
  // MASTER: no filter (sees everything)

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

  // DB totalStock 사용 (cron 6시간 주기 동기화 + 바코드/발주 시 갱신)
  // ONEWMS 실시간 조회는 바코드 페이지 및 발주 시에만 수행
  return paginated(serializeProducts(products, user.role), total, pageSize);
});

// POST: Create product with type validation
export const POST = withRole(["MASTER", "SUB_MASTER", "SELLER"], async (req: NextRequest, user: AuthUser) => {
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

  // SUB_MASTER: only their own center for CENTER products
  if (
    productType === "CENTER" &&
    user.role === "SUB_MASTER" &&
    user.centerId
  ) {
    const targetCenter = data.managedBy || user.centerId;
    if (targetCenter !== user.centerId) {
      return errors.forbidden("본인 센터의 상품만 등록할 수 있습니다.");
    }
  }

  // Determine centerId for CENTER products
  const centerId = productType === "CENTER"
    ? (user.role === "MASTER" ? data.managedBy : user.centerId)
    : null;

  // CENTER product: auto-generate code if not provided
  let productCode = data.code?.trim() || "";
  if (productType === "CENTER" && !productCode) {
    if (!centerId) {
      return errors.badRequest("센터 자사몰 상품은 관리 센터가 필수입니다.");
    }
    productCode = await generateCenterProductCode(centerId);
  }

  if (!productCode) {
    return errors.badRequest("상품코드를 입력하세요.");
  }

  // PRODUCT-02: Product code format validation
  const codeCheck = validateProductCode(productCode, productType);
  if (!codeCheck.valid) {
    return errors.badRequest(codeCheck.message);
  }

  // Phase 2: Product type validation
  if (productType === "HEADQUARTERS") {
    // WMS products: barcode required
    if (!data.barcode) {
      return errors.badRequest("본사(WMS) 상품은 바코드가 필수입니다.");
    }
  } else if (productType === "CENTER") {
    if (!centerId) {
      return errors.badRequest("센터 자사몰 상품은 관리 센터(managedBy)가 필수입니다.");
    }

    // Verify center exists
    const center = await prisma.center.findUnique({
      where: { id: centerId },
    });

    if (!center) {
      return errors.badRequest("존재하지 않는 센터입니다.");
    }

    // CENTER product: 가격 0원 차단
    if (data.sellPrice <= 0) {
      return errors.badRequest("판매가는 0보다 커야 합니다.");
    }
    if (data.supplyPrice <= 0) {
      return errors.badRequest("공급가는 0보다 커야 합니다.");
    }

    // Barcode uniqueness check (if provided)
    if (data.barcode) {
      const existing = await prisma.product.findUnique({ where: { barcode: data.barcode } });
      if (existing) {
        return errors.badRequest(`이미 등록된 바코드입니다: ${data.barcode}`);
      }
    }
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      code: productCode,
      name: data.name,
      barcode: data.barcode || "",
      sellPrice: data.sellPrice,
      supplyPrice: data.supplyPrice,
      originalPrice: data.originalPrice || null,
      totalStock: data.totalStock || 0,
      stockMujin: data.stockMujin || 0,
      stock1: data.stock1 || 0,
      stock2: data.stock2 || 0,
      stock3: data.stock3 || 0,
      productType,
      managedBy: centerId,
      isWmsProduct: productType === "HEADQUARTERS",
      category: data.category || null,
      registeredBy: user.userId,
      notes: data.notes || null,
    },
  });

  logAudit({
    userId: user.userId,
    userRole: user.role,
    userName: user.name,
    action: "CREATE",
    entityType: "Product",
    entityId: product.id,
    entityName: product.name,
    after: { code: product.code, name: product.name, barcode: product.barcode, productType, supplyPrice: data.supplyPrice, sellPrice: data.sellPrice, originalPrice: data.originalPrice, category: data.category },
    description: `상품 생성: ${product.name} (${product.code})`,
    request: req,
  });

  return ok(product);
});
