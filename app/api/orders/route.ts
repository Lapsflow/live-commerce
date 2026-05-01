import { NextRequest } from "next/server";
import { ok, error, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { z } from "zod";
import { reserveStock } from "@/lib/services/stock/reservation";
import { matchOrderToBroadcast } from "@/lib/services/broadcast/orderBroadcastMatching";
import { logAudit } from "@/lib/services/audit";
import { validateProductsForBroadcast } from "@/lib/services/products/canBroadcast";

// Phase 2: Order with Items Schema
const orderItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1),
  barcode: z.string(),
  productName: z.string(),
  supplyPrice: z.number().int().min(0),
});

const orderSchema = z.object({
  orderNo: z.string().min(1).max(50),
  sellerId: z.string().cuid().optional(), // Optional, defaults to current user
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  totalAmount: z.number().int().min(0),
  memo: z.string().max(500).optional(),
  recipient: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
});

// GET: List orders with filters
// Phase 2: withRole() middleware applied (MASTER, SUB_MASTER, SELLER)
export const GET = withRole(["MASTER", "SUB_MASTER", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  try {
    const { searchParams } = new URL(req.url);
    const productType = searchParams.get("productType") as "HEADQUARTERS" | "CENTER" | null;
    const search = searchParams.get("search");
    const pageIndex = parseInt(searchParams.get("pageIndex") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const where: any = {
      // CANCELLED 주문은 기본적으로 제외 (soft delete)
      status: { not: "CANCELLED" },
    };

    // Phase 2: Filter by productType
    if (productType) {
      where.productType = productType;
    }

    // Filter by search (orderNo)
    if (search) {
      where.orderNo = { contains: search, mode: "insensitive" };
    }

    // Authorization: SELLER can only see their own orders
    if (user.role === "SELLER") {
      where.sellerId = user.userId;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        take: pageSize,
        skip: pageIndex * pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          seller: {
            select: { id: true, name: true, email: true },
          },
          broadcast: {
            select: { id: true, code: true, platform: true, scheduledAt: true, status: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, productType: true },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // null-safe: 삭제된 seller/product 처리
    const safeOrders = orders.map((order) => ({
      ...order,
      seller: order.seller ?? { id: "", name: "삭제된 사용자", email: "" },
      items: order.items.map((item) => ({
        ...item,
        product: item.product ?? { id: "", name: "삭제된 상품", productType: "HEADQUARTERS" as const },
      })),
    }));

    return paginated(safeOrders, total, pageSize);
  } catch (err: any) {
    console.error("[ORDERS GET ERROR]", err?.message, err?.stack);
    return error("FETCH_FAILED", err?.message || "주문 목록 조회 실패", 500);
  }
});

// POST: Create order with auto-split by product type
// Phase 2: withRole() middleware applied (MASTER, SUB_MASTER, SELLER)
export const POST = withRole(["MASTER", "SUB_MASTER", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  try {
    const body = await req.json();
    const data = orderSchema.parse(body);

    // Default sellerId to current user
    const sellerId = data.sellerId || user.userId;

    // Phase 2: Group items by product type
    const itemsWithProducts = await Promise.all(
      data.items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { productType: true, name: true, barcode: true, supplyPrice: true, sellPrice: true, isActive: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        return {
          ...item,
          productType: product.productType,
          _product: product,
        };
      })
    );

    // 가격 0원 상품 차단: 셀러 발주 시 가격 미설정 상품 거부
    if (user.role === "SELLER") {
      const productsToValidate = itemsWithProducts.map((item) => ({
        id: item.productId,
        name: item._product.name,
        barcode: item._product.barcode,
        sellPrice: item._product.sellPrice,
        supplyPrice: item._product.supplyPrice,
        isActive: item._product.isActive,
      }));

      const { valid, ineligible } = validateProductsForBroadcast(productsToValidate);
      if (!valid) {
        const names = ineligible.map((p) => `${p.name} (${p.reason})`).join(", ");
        return error(
          "VALIDATION_ERROR",
          `가격이 설정되지 않은 상품은 발주할 수 없습니다: ${names}`,
          400
        );
      }
    }

    // Group by product type
    const wmsItems = itemsWithProducts.filter((item) => item.productType === "HEADQUARTERS");
    const centerItems = itemsWithProducts.filter((item) => item.productType === "CENTER");

    const createdOrders = [];

    // Helper function to create order
    const createOrderWithItems = async (
      items: typeof itemsWithProducts,
      productType: "HEADQUARTERS" | "CENTER",
      suffix: string
    ) => {
      const orderNo = `${data.orderNo}${suffix}`;

      // Calculate totals for this group
      const totalSupply = items.reduce((sum, item) => sum + (item.supplyPrice * item.quantity), 0);

      // Calculate total items across all groups for proportional split
      const allItemsQuantity = itemsWithProducts.reduce((sum, i) => sum + i.quantity, 0);
      const thisGroupQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

      // Proportional totalAmount based on item quantity ratio
      const proportionalTotalAmount = suffix
        ? Math.round((data.totalAmount * thisGroupQuantity) / allItemsQuantity)
        : data.totalAmount;

      const totalMargin = proportionalTotalAmount - totalSupply;

      const order = await prisma.order.create({
        data: {
          orderNo,
          sellerId,
          status: data.status || "PENDING",
          totalAmount: proportionalTotalAmount,
          totalMargin,
          memo: data.memo,
          recipient: data.recipient,
          phone: data.phone,
          address: data.address,
          productType, // Phase 2: Set product type
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              barcode: item.barcode,
              productName: item.productName,
              supplyPrice: item.supplyPrice,
              totalSupply: item.supplyPrice * item.quantity,
              margin: (proportionalTotalAmount / thisGroupQuantity) - item.supplyPrice,
              productType, // Phase 2: Set product type on item
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return order;
    };

    // Phase 2: Create separate orders if mixed types
    if (wmsItems.length > 0 && centerItems.length > 0) {
      // Mixed types: create 2 orders with suffixes wrapped in transaction
      const wmsPromise = createOrderWithItems(wmsItems, "HEADQUARTERS", "-WMS");
      const centerPromise = createOrderWithItems(centerItems, "CENTER", "-CENTER");
      const [wmsOrder, centerOrder] = await Promise.all([wmsPromise, centerPromise]);

      createdOrders.push(wmsOrder, centerOrder);

      // ✨ 재고 선점: split 주문에도 적용
      for (const order of createdOrders) {
        const reserveResult = await reserveStock(order.id);
        if (!reserveResult.success) {
          // 실패 시 생성된 주문 soft cancel
          for (const o of createdOrders) {
            await prisma.order.update({
              where: { id: o.id },
              data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "STOCK_RESERVE_FAILED" },
            }).catch(() => {});
          }
          return error(
            "STOCK_RESERVE_FAILED",
            reserveResult.error || "재고 선점 실패",
            400
          );
        }
      }

      // ✨ LIVE-03: 발주서→방송 자동 매칭 (split 주문도)
      const splitMatchResults = [];
      for (const order of createdOrders) {
        try {
          const result = await matchOrderToBroadcast(order.id, sellerId, new Date());
          splitMatchResults.push({ orderId: order.id, ...result });
        } catch (err) {
          console.error("[ORDER-BROADCAST MATCH ERROR]", order.id, err);
          splitMatchResults.push({ orderId: order.id, matched: false, reason: "매칭 처리 중 오류" });
        }
      }

      for (const order of createdOrders) {
        logAudit({
          userId: user.userId,
          userRole: user.role,
          userName: user.name,
          action: "CREATE",
          entityType: "Order",
          entityId: order.id,
          entityName: order.orderNo,
          after: { orderNo: order.orderNo, totalAmount: order.totalAmount, productType: order.productType, itemCount: order.items.length },
          description: `발주 생성 (분할): ${order.orderNo}`,
          request: req,
        });
      }

      return ok({
        message: "주문이 상품 유형별로 분리되어 생성되었습니다.",
        orders: createdOrders,
        split: true,
        matchResults: splitMatchResults,
      });
    } else if (wmsItems.length > 0) {
      // Only WMS items
      const order = await createOrderWithItems(wmsItems, "HEADQUARTERS", "");
      createdOrders.push(order);
    } else if (centerItems.length > 0) {
      // Only CENTER items
      const order = await createOrderWithItems(centerItems, "CENTER", "");
      createdOrders.push(order);
    }

    // ✨ 재고 선점: 생성된 주문에 대해 재고 선점 처리
    for (const order of createdOrders) {
      const reserveResult = await reserveStock(order.id);
      if (!reserveResult.success) {
        // 선점 실패 시 주문 soft cancel (hard delete 금지)
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "STOCK_RESERVE_FAILED" },
        });
        return error(
          "STOCK_RESERVE_FAILED",
          reserveResult.error || "재고 선점 실패",
          400
        );
      }
    }

    // ✨ LIVE-03: 발주서→방송 자동 매칭 (실패해도 주문 생성은 유지)
    const matchResults = [];
    for (const order of createdOrders) {
      try {
        const result = await matchOrderToBroadcast(order.id, sellerId, new Date());
        matchResults.push({ orderId: order.id, ...result });
      } catch (err) {
        console.error("[ORDER-BROADCAST MATCH ERROR]", order.id, err);
        matchResults.push({ orderId: order.id, matched: false, reason: "매칭 처리 중 오류" });
      }
    }

    for (const order of createdOrders) {
      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "CREATE",
        entityType: "Order",
        entityId: order.id,
        entityName: order.orderNo,
        after: { orderNo: order.orderNo, totalAmount: order.totalAmount, productType: order.productType, itemCount: order.items.length },
        description: `발주 생성: ${order.orderNo}`,
        request: req,
      });
    }

    return ok({
      message: "주문이 생성되었습니다.",
      orders: createdOrders,
      split: false,
      matchResults,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[ORDER CREATE ERROR]", err);
    return error("CREATE_FAILED", err.message, 500);
  }
});
