/**
 * Stock Reservation Service
 * PDF 스펙 7페이지: 재고 선점 구조
 *
 * 발주 시 재고 차감이 아닌 "판매 권한 선점"
 * - 선점: reservedStock 증가, available = totalStock - reservedStock
 * - 입금확인: reservedStock 감소 + totalStock 감소 (WMS 전송)
 * - 취소/만료: reservedStock 감소 (재고 해제)
 */

import { prisma } from "@/lib/db/prisma";
import { getRealtimeStock } from "@/lib/services/onewms/realtime";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const MAX_RETRY = 3;

// ─── Types ───

interface StockCheckItem {
  productId: string;
  quantity: number;
}

interface AvailabilityResult {
  available: boolean;
  items: Array<{
    productId: string;
    productName: string;
    requested: number;
    availableStock: number;
    sufficient: boolean;
  }>;
}

interface ReservationResult {
  success: boolean;
  error?: string;
}

interface ReleaseResult {
  success: boolean;
  released: number;
  error?: string;
}

// ─── Functions ───

/**
 * 여러 주문의 같은 상품 재고를 한 번에 선점 (bulk upload 최적화)
 * - 같은 productId의 수량을 합산
 * - ONEWMS 실시간 조회 (Promise.allSettled)
 * - 한 트랜잭션에서 모든 product의 reservedStock 원자적 update
 * - atomic update 패턴: UPDATE WHERE totalStock - reservedStock >= totalQty
 */
export async function reserveStockBulk(
  productQtyMap: Map<string, number>,
  options: { orderIds: string[] }
): Promise<{ success: boolean; failed: Array<{ productId: string; reason: string }> }> {
  try {
    const productIds = Array.from(productQtyMap.keys());

    // 1. 상품 정보 조회
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        totalStock: true,
        reservedStock: true,
        productType: true,
        onewmsCode: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. ONEWMS 실시간 조회 (본사 상품만)
    const hqProducts = products.filter(
      (p) => p.productType === "HEADQUARTERS" && p.onewmsCode
    );
    const realtimeStocks = new Map<string, number>();
    if (hqProducts.length > 0) {
      const settled = await Promise.allSettled(
        hqProducts.map(async (p) => {
          const stock = await getRealtimeStock(p.onewmsCode!);
          return { id: p.id, stock };
        })
      );
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value.stock !== null) {
          realtimeStocks.set(result.value.id, result.value.stock);
        }
      }
    }

    // 3. 트랜잭션: 모든 product 의 reservedStock 원자적 update
    const failed: Array<{ productId: string; reason: string }> = [];

    await prisma.$transaction(
      async (tx) => {
        for (const [productId, qty] of productQtyMap.entries()) {
          const product = productMap.get(productId);
          if (!product) {
            failed.push({ productId, reason: "상품을 찾을 수 없습니다" });
            continue;
          }

          // 본사 상품: ONEWMS 실시간값으로 DB 갱신
          const realtimeStock = realtimeStocks.get(productId);
          if (
            product.productType === "HEADQUARTERS" &&
            product.onewmsCode &&
            realtimeStock !== undefined
          ) {
            await tx.product.update({
              where: { id: productId },
              data: { totalStock: realtimeStock },
            });
          }

          // ✅ Atomic update: $executeRaw 사용 (ReadCommitted isolation에서 race condition 방지)
          const updated = await tx.$executeRaw`
            UPDATE "Product"
            SET "reservedStock" = "reservedStock" + ${qty}
            WHERE id = ${productId}
              AND "totalStock" - "reservedStock" >= ${qty}
          `;

          if (updated === 0) {
            failed.push({
              productId,
              reason: `재고 부족: 다른 발주가 선점했습니다`,
            });
          } else {
            // StockReservation 레코드 생성 (각 주문별로)
            for (const orderId of options.orderIds) {
              const order = await tx.order.findUnique({
                where: { id: orderId },
                select: {
                  items: {
                    where: { productId },
                    select: { quantity: true },
                  },
                },
              });

              if (order && order.items.length > 0) {
                const itemQty = order.items[0].quantity;
                await tx.stockReservation.create({
                  data: {
                    orderId,
                    productId,
                    quantity: itemQty,
                    status: "ACTIVE",
                  },
                });
              }
            }
          }
        }
      },
      {
        isolationLevel: "ReadCommitted",
        timeout: 15000,
      }
    );

    return { success: failed.length === 0, failed };
  } catch (err: any) {
    console.error("[RESERVE_STOCK_BULK ERROR]", err);
    return {
      success: false,
      failed: Array.from(productQtyMap.entries()).map(([productId]) => ({
        productId,
        reason: err.message,
      })),
    };
  }
}

/**
 * 가용 재고 확인 (ONEWMS 실시간)
 * 본사 상품: ONEWMS realtime - reservedStock
 * 센터 상품: DB totalStock - reservedStock
 */
export async function checkAvailability(
  items: StockCheckItem[]
): Promise<AvailabilityResult> {
  const productIds = items.map((i) => i.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      totalStock: true,
      reservedStock: true,
      productType: true,
      onewmsCode: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Fetch realtime stock for HQ products with onewmsCode
  const hqProducts = products.filter(
    (p) => p.productType === "HEADQUARTERS" && p.onewmsCode
  );

  const realtimeStocks = new Map<string, number>();
  if (hqProducts.length > 0) {
    const settled = await Promise.allSettled(
      hqProducts.map(async (p) => {
        const stock = await getRealtimeStock(p.onewmsCode!);
        return { id: p.id, stock };
      })
    );
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value.stock !== null) {
        realtimeStocks.set(result.value.id, result.value.stock);
      }
    }
  }

  const result = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      return {
        productId: item.productId,
        productName: "상품 없음",
        requested: item.quantity,
        availableStock: 0,
        sufficient: false,
      };
    }

    // Use realtime stock if available, otherwise DB
    const baseStock = realtimeStocks.get(product.id) ?? product.totalStock;
    const availableStock = Math.max(0, baseStock - product.reservedStock);
    return {
      productId: item.productId,
      productName: product.name,
      requested: item.quantity,
      availableStock,
      sufficient: availableStock >= item.quantity,
    };
  });

  return {
    available: result.every((r) => r.sufficient),
    items: result,
  };
}

/**
 * 재고 선점 (발주 생성 시) - ONEWMS 실시간 검증 포함
 * - 본사 상품: ONEWMS 실시간 조회 후 DB 갱신 + 선점
 * - 센터 상품: DB 기준 선점
 * - Product.reservedStock 증가
 * - StockReservation ACTIVE 레코드 생성
 * - Order.expiresAt 설정 (3시간 후)
 * - Serializable isolation + exponential backoff retry (max 3)
 */
export async function reserveStock(
  orderId: string
): Promise<ReservationResult> {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      // 1. 트랜잭션 전: 주문 조회 + 본사 상품 ONEWMS 실시간 조회
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, onewmsCode: true, productType: true },
              },
            },
          },
        },
      });

      if (!order) return { success: false, error: "주문을 찾을 수 없습니다." };
      if (order.status !== "PENDING") return { success: false, error: "대기 상태의 주문만 선점 가능합니다." };

      // Pre-fetch realtime stock for HQ products (outside transaction)
      const realtimeStocks = new Map<string, number>();
      const hqItems = order.items.filter(
        (item) =>
          item.product?.productType === "HEADQUARTERS" &&
          item.product?.onewmsCode
      );

      if (hqItems.length > 0) {
        const settled = await Promise.allSettled(
          hqItems.map(async (item) => {
            const stock = await getRealtimeStock(item.product!.onewmsCode!);
            return { productId: item.productId, stock };
          })
        );
        for (const result of settled) {
          if (result.status === "fulfilled" && result.value.stock !== null) {
            realtimeStocks.set(result.value.productId, result.value.stock);
          }
        }
      }

      // 2. Serializable 트랜잭션으로 선점
      await prisma.$transaction(
        async (tx) => {
          for (const item of order.items) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: {
                id: true,
                totalStock: true,
                reservedStock: true,
                productType: true,
                onewmsCode: true,
              },
            });

            if (!product) {
              throw new Error(`상품을 찾을 수 없습니다: ${item.productId}`);
            }

            // 본사 상품: ONEWMS 실시간 값으로 DB 갱신
            let baseStock = product.totalStock;
            const realtimeStock = realtimeStocks.get(product.id);
            if (
              product.productType === "HEADQUARTERS" &&
              product.onewmsCode &&
              realtimeStock !== undefined
            ) {
              baseStock = realtimeStock;
              await tx.product.update({
                where: { id: product.id },
                data: { totalStock: realtimeStock },
              });
            }

            const available = baseStock - product.reservedStock;
            if (available < item.quantity) {
              throw new Error(
                `재고 부족: ${item.productName} (가용: ${available}, 요청: ${item.quantity})`
              );
            }

            // reservedStock 증가
            await tx.product.update({
              where: { id: item.productId },
              data: { reservedStock: { increment: item.quantity } },
            });

            // StockReservation 레코드 생성
            await tx.stockReservation.create({
              data: {
                orderId,
                productId: item.productId,
                quantity: item.quantity,
                status: "ACTIVE",
              },
            });
          }

          // 만료 시각 설정
          await tx.order.update({
            where: { id: orderId },
            data: {
              expiresAt: new Date(Date.now() + THREE_HOURS_MS),
            },
          });
        },
        {
          isolationLevel: "Serializable",
          timeout: 10000,
        }
      );

      return { success: true };
    } catch (err: any) {
      // Serializable conflict → retry with exponential backoff
      const isSerializationFailure =
        err.message?.includes("could not serialize") ||
        err.code === "P2034";

      if (isSerializationFailure && attempt < MAX_RETRY) {
        const delay = Math.pow(2, attempt) * 100;
        console.warn(
          `[RESERVE_STOCK] Serialization conflict, retry ${attempt}/${MAX_RETRY} after ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error("[RESERVE_STOCK ERROR]", err);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: "최대 재시도 횟수 초과" };
}

/**
 * 재고 해제 (취소/만료 시)
 * - Product.reservedStock 감소
 * - StockReservation → RELEASED
 * - Order.status → REJECTED
 */
export async function releaseStock(
  orderId: string,
  reason: "EXPIRED" | "SELLER_CANCELLED" | "ADMIN_CANCELLED"
): Promise<ReleaseResult> {
  try {
    let releasedCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. ACTIVE 예약 조회
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: "ACTIVE" },
      });

      if (reservations.length === 0) {
        // 이미 해제되었거나 예약 없음 - 상태만 업데이트
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "REJECTED",
            cancelledAt: new Date(),
            cancelReason: reason,
          },
        });
        return;
      }

      // 2. 각 예약에 대해 재고 해제
      for (const reservation of reservations) {
        await tx.product.update({
          where: { id: reservation.productId },
          data: { reservedStock: { decrement: reservation.quantity } },
        });

        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            releaseType: reason,
          },
        });

        releasedCount++;
      }

      // 3. 주문 상태 업데이트
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "REJECTED",
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });
    });

    return { success: true, released: releasedCount };
  } catch (err: any) {
    console.error("[RELEASE_STOCK ERROR]", err);
    return { success: false, released: 0, error: err.message };
  }
}

/**
 * 예약 전환 (입금 확인 시)
 * - Product.reservedStock 감소, totalStock 감소
 * - StockReservation → CONVERTED
 * - Order: paymentStatus → PAID, status → APPROVED
 * - OrderSellerMatching upsert (셀러-상품 매칭 데이터 축적)
 */
export async function convertReservation(
  orderId: string
): Promise<ReservationResult> {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. 주문 조회
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new Error("주문을 찾을 수 없습니다.");
      if (order.paymentStatus === "PAID") throw new Error("이미 입금확인된 발주입니다.");
      if (order.status === "REJECTED") throw new Error("취소된 발주는 입금확인할 수 없습니다.");

      // 2. ACTIVE 예약 조회
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: "ACTIVE" },
      });

      // 3. 각 예약에 대해 전환
      for (const reservation of reservations) {
        await tx.product.update({
          where: { id: reservation.productId },
          data: {
            reservedStock: { decrement: reservation.quantity },
            totalStock: { decrement: reservation.quantity },
          },
        });

        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            status: "CONVERTED",
            releasedAt: new Date(),
            releaseType: "PAYMENT_CONFIRMED",
          },
        });
      }

      // 4. 주문 상태 업데이트
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });

      // 5. 셀러-상품 매칭 데이터 축적
      for (const item of order.items) {
        await tx.orderSellerMatching.upsert({
          where: {
            sellerId_productId: {
              sellerId: order.sellerId,
              productId: item.productId,
            },
          },
          create: {
            orderId,
            sellerId: order.sellerId,
            productId: item.productId,
            orderCount: 1,
            totalQuantity: item.quantity,
            totalRevenue: item.totalSupply,
            lastOrderAt: new Date(),
            matchReason: "order_confirmed",
          },
          update: {
            orderId,
            orderCount: { increment: 1 },
            totalQuantity: { increment: item.quantity },
            totalRevenue: { increment: item.totalSupply },
            lastOrderAt: new Date(),
          },
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error("[CONVERT_RESERVATION ERROR]", err);
    return { success: false, error: err.message };
  }
}
