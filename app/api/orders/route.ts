import { NextRequest } from "next/server";
import { ok, error, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { z } from "zod";
import { matchOrderToBroadcast } from "@/lib/services/broadcast/orderBroadcastMatching";
import { logAudit } from "@/lib/services/audit";
import { validateProductsForBroadcast } from "@/lib/services/products/canBroadcast";
import { sendNotification } from "@/lib/services/notifications";
import { syncStocksForProducts } from "@/lib/services/onewms/stockSync";
import { sanitizeMemo } from "@/lib/utils/memo";

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

    // Phase 2: SUB_MASTER can only see orders from sellers in their center
    if (user.role === "SUB_MASTER" && user.centerId) {
      where.seller = { centerId: user.centerId };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        take: pageSize,
        skip: pageIndex * pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              center: { select: { name: true } },
            },
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
          select: { productType: true, managedBy: true, name: true, barcode: true, supplyPrice: true, sellPrice: true, isActive: true },
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

    // ─────────────────────────────────────────────────────────────
    // 발주 시점 즉시 ONEWMS 재고 sync (2026-05-13 대표님 결정 옵션 B)
    //   본사 제품(HEADQUARTERS)에 대해서만 발주 등록 직전 batch sync
    //   발주 검증 + 차감이 ONEWMS 최신 재고 기준으로 이루어지도록.
    //   sync 실패해도 발주 흐름 자체는 막지 않음 (fire-and-forget + await).
    //   5초 timeout 으로 ONEWMS 응답 지연 시 발주 차단 방지.
    // ─────────────────────────────────────────────────────────────
    if (wmsItems.length > 0) {
      const hqProductIds = wmsItems.map((item) => item.productId);
      try {
        await Promise.race([
          syncStocksForProducts(hqProductIds),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("ONEWMS sync timeout")), 5000)
          ),
        ]);
      } catch (syncErr) {
        // 동기화 실패해도 발주는 계속 진행 (운영 안정성 우선)
        console.warn(
          "[ORDER_PRESYNC] ONEWMS sync 실패, cron sync 결과 사용:",
          syncErr instanceof Error ? syncErr.message : syncErr
        );
      }
    }

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

      // Phase 5: Set processingCenterId for CENTER orders
      const processingCenterId = productType === "CENTER"
        ? (items[0] as any)?._product?.managedBy ?? null
        : null;

      const order = await prisma.order.create({
        data: {
          orderNo,
          sellerId,
          status: data.status || "PENDING",
          totalAmount: proportionalTotalAmount,
          totalMargin,
          // 2026-06-10: 모든 발주 생성 입구에 placeholder 메모 필터 적용 (bulk 와 동일)
          memo: sanitizeMemo(data.memo) || undefined,
          recipient: data.recipient,
          phone: data.phone,
          address: data.address,
          productType, // Phase 2: Set product type
          processingCenterId, // Phase 5: Center routing
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

      // Phase 7: 신규 발주 접수 알림 → 관리자 (fire-and-forget)
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["MASTER", "SUB_MASTER"] } },
          select: { name: true, phone: true, email: true },
        });
        const seller = await prisma.user.findUnique({
          where: { id: sellerId },
          select: { name: true },
        });
        for (const order of createdOrders) {
          for (const admin of admins) {
            if (admin.phone) {
              sendNotification({
                type: "ORDER_CREATED",
                recipient: { name: admin.name, phone: admin.phone, email: admin.email || undefined },
                variables: {
                  orderNo: order.orderNo,
                  sellerName: seller?.name || "-",
                  itemCount: String(order.items.length),
                  totalAmount: String(order.totalAmount),
                  productType: order.productType || "-",
                },
                orderId: order.id,
              }).catch((err) => console.error("[ORDER_CREATED_NOTIF]", err));
            }
          }
        }
      } catch (notifErr) {
        console.error("[ORDER_CREATED_NOTIF]", notifErr);
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

    // Phase 7: 신규 발주 접수 알림 → 관리자 (fire-and-forget)
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["MASTER", "SUB_MASTER"] } },
        select: { name: true, phone: true, email: true },
      });
      const seller = await prisma.user.findUnique({
        where: { id: sellerId },
        select: { name: true },
      });
      for (const order of createdOrders) {
        for (const admin of admins) {
          if (admin.phone) {
            sendNotification({
              type: "ORDER_CREATED",
              recipient: { name: admin.name, phone: admin.phone, email: admin.email || undefined },
              variables: {
                orderNo: order.orderNo,
                sellerName: seller?.name || "-",
                itemCount: String(order.items.length),
                totalAmount: String(order.totalAmount),
                productType: order.productType || "-",
              },
              orderId: order.id,
            }).catch((err) => console.error("[ORDER_CREATED_NOTIF]", err));
          }
        }
      }
    } catch (notifErr) {
      console.error("[ORDER_CREATED_NOTIF]", notifErr);
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
