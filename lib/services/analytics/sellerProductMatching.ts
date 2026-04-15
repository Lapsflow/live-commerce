/**
 * Seller-Product Matching Analytics Service
 * Automatically accumulates seller-product matching data and calculates RFM-based recommendation scores
 */

import { prisma } from '@/lib/db/prisma';

/**
 * Record seller-product match when order is completed
 * Accumulates orderCount, totalQuantity, totalRevenue, and recalculates scores
 */
export async function recordSellerProductMatch(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      seller: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  console.log(
    `[Matching] Recording seller-product matches for order ${order.orderNo}`
  );

  // Record or update matching for each product in the order
  for (const item of order.items) {
    await prisma.orderSellerMatching.upsert({
      where: {
        sellerId_productId: {
          sellerId: order.sellerId,
          productId: item.productId,
        },
      },
      create: {
        orderId: order.id,
        sellerId: order.sellerId,
        productId: item.productId,
        matchReason: 'order_completion',
        orderCount: 1,
        totalQuantity: item.quantity,
        totalRevenue: item.totalSupply, // Use totalSupply from order item
        lastOrderAt: new Date(),
        recommendScore: 0, // Will be calculated later
      },
      update: {
        orderId: order.id, // Update to latest order
        orderCount: { increment: 1 },
        totalQuantity: { increment: item.quantity },
        totalRevenue: { increment: item.totalSupply },
        lastOrderAt: new Date(),
      },
    });

    console.log(
      `[Matching] Updated matching for seller ${order.sellerId} - product ${item.product.name}`
    );
  }

  // Recalculate recommendation scores for this seller
  await recalculateRecommendScores(order.sellerId);

  console.log(`[Matching] Completed for order ${order.orderNo}`);
}

/**
 * Recalculate RFM-based recommendation scores for a seller
 *
 * RFM Model:
 * - Recency (최근성): Days since last order (lower is better)
 * - Frequency (빈도): Number of orders (higher is better)
 * - Monetary (금액): Total revenue (higher is better)
 *
 * Score Formula:
 * - recencyScore = max(0, 100 - daysSince * 2)
 * - frequencyScore = min(100, orderCount * 10)
 * - monetaryScore = min(100, totalRevenue / 10000)
 * - recommendScore = recencyScore * 0.3 + frequencyScore * 0.5 + monetaryScore * 0.2
 */
export async function recalculateRecommendScores(sellerId: string): Promise<void> {
  const matches = await prisma.orderSellerMatching.findMany({
    where: { sellerId },
  });

  console.log(
    `[Matching] Recalculating scores for seller ${sellerId} (${matches.length} products)`
  );

  for (const match of matches) {
    // Calculate RFM components
    const recencyDays = daysSince(match.lastOrderAt);
    const frequency = match.orderCount;
    const monetary = match.totalRevenue;

    // Calculate individual scores (0-100 range)
    const recencyScore = Math.max(0, 100 - recencyDays * 2); // 최근일수록 높은 점수
    const frequencyScore = Math.min(100, frequency * 10); // 주문 횟수가 많을수록 높은 점수
    const monetaryScore = Math.min(100, monetary / 10000); // 총 매출이 높을수록 높은 점수

    // Weighted combination (Frequency가 가장 중요: 50%)
    const recommendScore = recencyScore * 0.3 + frequencyScore * 0.5 + monetaryScore * 0.2;

    // Update score
    await prisma.orderSellerMatching.update({
      where: { id: match.id },
      data: { recommendScore },
    });

    console.log(
      `[Matching] Product ${match.productId}: R=${recencyScore.toFixed(1)} F=${frequencyScore.toFixed(1)} M=${monetaryScore.toFixed(1)} → Score=${recommendScore.toFixed(1)}`
    );
  }

  console.log(`[Matching] Score recalculation completed for seller ${sellerId}`);
}

/**
 * Get recommended products for a seller based on RFM scores
 */
export async function getRecommendedProducts(
  sellerId: string,
  options: {
    minScore?: number;
    limit?: number;
  } = {}
) {
  const { minScore = 50, limit = 10 } = options;

  const recommendations = await prisma.orderSellerMatching.findMany({
    where: {
      sellerId,
      recommendScore: { gte: minScore },
    },
    include: {
      product: true,
    },
    orderBy: {
      recommendScore: 'desc',
    },
    take: limit,
  });

  return recommendations.map((match) => ({
    product: match.product,
    score: match.recommendScore,
    orderCount: match.orderCount,
    totalQuantity: match.totalQuantity,
    totalRevenue: match.totalRevenue,
    lastOrderAt: match.lastOrderAt,
  }));
}

/**
 * Calculate days since a given date
 */
function daysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}
