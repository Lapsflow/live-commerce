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

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

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
 * 가용 재고 확인
 * available = totalStock - reservedStock
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
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

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

    const availableStock = product.totalStock - product.reservedStock;
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
 * 재고 선점 (발주 생성 시)
 * - Product.reservedStock 증가
 * - StockReservation ACTIVE 레코드 생성
 * - Order.expiresAt 설정 (3시간 후)
 */
export async function reserveStock(
  orderId: string
): Promise<ReservationResult> {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. 주문 + 아이템 조회
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new Error("주문을 찾을 수 없습니다.");
      if (order.status !== "PENDING") throw new Error("대기 상태의 주문만 선점 가능합니다.");

      // 2. 상품별 가용 재고 확인 + 선점 (race condition 방지: 트랜잭션 내)
      for (const item of order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, totalStock: true, reservedStock: true },
        });

        if (!product) {
          throw new Error(`상품을 찾을 수 없습니다: ${item.productId}`);
        }

        const available = product.totalStock - product.reservedStock;
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

      // 3. 만료 시각 설정
      await tx.order.update({
        where: { id: orderId },
        data: {
          expiresAt: new Date(Date.now() + THREE_HOURS_MS),
        },
      });
    });

    return { success: true };
  } catch (err: any) {
    console.error("[RESERVE_STOCK ERROR]", err);
    return { success: false, error: err.message };
  }
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
