import { NextRequest } from "next/server";
import { ok, error, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { z } from "zod";
import { reserveStock } from "@/lib/services/stock/reservation";

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
  adminId: z.string().cuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  totalAmount: z.number().int().min(0),
  memo: z.string().max(500).optional(),
  recipient: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
});

// GET: List orders with filters
// Phase 2: withRole() middleware applied (MASTER, ADMIN, SELLER)
export const GET = withRole(["MASTER", "ADMIN", "SELLER"], async (req: NextRequest, user: AuthUser) => {
  try {
    const { searchParams } = new URL(req.url);
    const productType = searchParams.get("productType") as "HEADQUARTERS" | "CENTER" | null;
    const search = searchParams.get("search");
    const pageIndex = parseInt(searchParams.get("pageIndex") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const where: any = {};

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

    return paginated(orders, total, pageSize);
  } catch (err: any) {
    console.error("[ORDERS GET ERROR]", err);
    return error("FETCH_FAILED", err.message, 500);
  }
});

// POST: Create order with auto-split by product type
// Phase 2: withRole() middleware applied (MASTER, ADMIN, SELLER)
export const POST = withRole(["MASTER", "ADMIN", "SELLER"], async (req: NextRequest, user: AuthUser) => {
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
          select: { productType: true, name: true, barcode: true, supplyPrice: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        return {
          ...item,
          productType: product.productType,
        };
      })
    );

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
          adminId: data.adminId,
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
          // 실패 시 생성된 주문 모두 삭제
          for (const o of createdOrders) {
            await prisma.order.delete({ where: { id: o.id } }).catch(() => {});
          }
          return error(
            "STOCK_RESERVE_FAILED",
            reserveResult.error || "재고 선점 실패",
            400
          );
        }
      }

      return ok({
        message: "주문이 상품 유형별로 분리되어 생성되었습니다.",
        orders: createdOrders,
        split: true,
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
        // 선점 실패 시 주문 삭제 (롤백)
        await prisma.order.delete({ where: { id: order.id } });
        return error(
          "STOCK_RESERVE_FAILED",
          reserveResult.error || "재고 선점 실패",
          400
        );
      }
    }

    return ok({
      message: "주문이 생성되었습니다.",
      orders: createdOrders,
      split: false,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[ORDER CREATE ERROR]", err);
    return error("CREATE_FAILED", err.message, 500);
  }
});
