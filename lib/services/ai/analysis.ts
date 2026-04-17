/**
 * AI Analysis Service
 * Unified service for product analysis using Gemini AI
 */

import { createGeminiClient, PricingContext, SalesContext } from '@/lib/ai/claude';
import { getPricing } from '@/lib/services/pricing/marketPricing';
import { prisma } from '@/lib/db/prisma';
import { getCached, setCached, CACHE_TTL } from '@/lib/cache/redis';

export interface ProductAnalysisResult {
  productId: string;
  barcode: string;
  productName: string;
  pricing: {
    competitiveness: {
      score: number;
      position: 'low' | 'mid' | 'high';
      insights: string[];
    };
    marginHealth: {
      isHealthy: boolean;
      currentMargin: number;
      recommendedMargin: number;
      reasoning: string;
    };
    actionItems: string[];
  };
  sales: {
    keyPoints: string[];
    targetCustomer: string;
    broadcastScript: string;
    recommendedBundle: string[];
    cautions: string[];
  };
  metadata: {
    analyzedAt: Date;
    tokensUsed: number;
    estimatedCost: number;
    cached: boolean;
  };
}

export interface AnalysisOptions {
  skipCache?: boolean;
  storeInDb?: boolean;
}

/**
 * Analyze product with AI
 */
export async function analyzeProduct(
  barcode: string,
  options: AnalysisOptions = {}
): Promise<ProductAnalysisResult> {
  const { skipCache = false, storeInDb = true } = options;

  // 1. Check cache first
  if (!skipCache) {
    const cacheKey = `ai:analysis:${barcode}`;
    const cached = await getCached<ProductAnalysisResult>(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true,
        },
      };
    }
  }

  // 2. Fetch product data
  const product = await prisma.product.findUnique({
    where: { barcode },
    include: {
      sellerMatches: {
        take: 5,
        orderBy: { recommendScore: 'desc' },
      },
    },
  });

  if (!product) {
    throw new Error('상품을 찾을 수 없습니다');
  }

  // 3. Fetch market pricing
  const pricing = await getPricing(barcode, {
    ourPrice: product.sellPrice,
    skipCache: false,
    storeInDb: true,
  });

  // 4. Build pricing context
  const pricingContext: PricingContext = {
    productName: product.name,
    barcode: product.barcode,
    ourPrice: product.sellPrice,
    marginRate:
      ((product.sellPrice - product.supplyPrice) / product.sellPrice) * 100,
    marketAvgPrice: pricing.market.avgPrice,
    marketMinPrice: pricing.market.minPrice,
    naverAvgPrice: pricing.naver?.avgPrice || 0,
    coupangAvgPrice: pricing.coupang?.avgPrice || 0,
    stockQuantity: product.totalStock,
  };

  // 5. Build sales context
  const salesContext: SalesContext = {
    productName: product.name,
    barcode: product.barcode,
    price: product.sellPrice,
    stockQuantity: product.totalStock,
    category: '일반', // Default category - Product model doesn't have category field yet
    recentSalesCount: product.sellerMatches.reduce(
      (sum, match) => sum + match.orderCount,
      0
    ),
    avgOrderValue: product.sellPrice,
    rfmScore: product.sellerMatches[0]?.recommendScore || 0,
  };

  // 6. Call Gemini API
  const client = createGeminiClient();

  const [pricingAnalysis, salesAnalysis] = await Promise.all([
    client.analyzePricing(pricingContext),
    client.analyzeSales(salesContext),
  ]);

  const totalTokens =
    pricingAnalysis.usage.totalTokens + salesAnalysis.usage.totalTokens;
  const totalCost =
    pricingAnalysis.usage.estimatedCost + salesAnalysis.usage.estimatedCost;

  // 7. Build result
  const result: ProductAnalysisResult = {
    productId: product.id,
    barcode: product.barcode,
    productName: product.name,
    pricing: {
      competitiveness: pricingAnalysis.analysis.competitiveness,
      marginHealth: pricingAnalysis.analysis.marginHealth,
      actionItems: pricingAnalysis.analysis.actionItems,
    },
    sales: {
      keyPoints: salesAnalysis.analysis.keyPoints,
      targetCustomer: salesAnalysis.analysis.targetCustomer,
      broadcastScript: salesAnalysis.analysis.broadcastScript,
      recommendedBundle: salesAnalysis.analysis.recommendedBundle,
      cautions: salesAnalysis.analysis.cautions,
    },
    metadata: {
      analyzedAt: new Date(),
      tokensUsed: totalTokens,
      estimatedCost: totalCost,
      cached: false,
    },
  };

  // 8. Store in cache (6 hours TTL)
  const cacheKey = `ai:analysis:${barcode}`;
  await setCached(cacheKey, result, CACHE_TTL.PRICING);

  // 9. Store in database (optional)
  if (storeInDb) {
    await storeAnalysisInDb(result, pricingAnalysis, salesAnalysis);
  }

  // 10. Update daily usage stats
  await updateDailyUsageStats(totalTokens, totalCost);

  return result;
}

/**
 * Store analysis in database
 */
async function storeAnalysisInDb(
  result: ProductAnalysisResult,
  pricingAnalysis: any,
  salesAnalysis: any
): Promise<void> {
  try {
    // Store pricing analysis
    await prisma.aIAnalysis.create({
      data: {
        productId: result.productId,
        barcode: result.barcode,
        analysisType: 'pricing',
        prompt: 'Pricing analysis prompt',
        response: JSON.stringify(pricingAnalysis.analysis),
        parsedData: pricingAnalysis.analysis as any,
        tokensUsed: pricingAnalysis.usage.totalTokens,
        estimatedCost: pricingAnalysis.usage.estimatedCost,
        modelVersion: 'gemini-1.5-flash',
      },
    });

    // Store sales analysis
    await prisma.aIAnalysis.create({
      data: {
        productId: result.productId,
        barcode: result.barcode,
        analysisType: 'sales',
        prompt: 'Sales analysis prompt',
        response: JSON.stringify(salesAnalysis.analysis),
        parsedData: salesAnalysis.analysis as any,
        tokensUsed: salesAnalysis.usage.totalTokens,
        estimatedCost: salesAnalysis.usage.estimatedCost,
        modelVersion: 'gemini-1.5-flash',
      },
    });
  } catch (error) {
    console.error('Failed to store analysis in database:', error);
    // Don't throw - DB storage is optional
  }
}

/**
 * Update daily usage statistics
 */
async function updateDailyUsageStats(
  tokens: number,
  cost: number
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.aIUsageStats.upsert({
      where: { date: today },
      create: {
        date: today,
        totalRequests: 1,
        totalTokens: tokens,
        totalCost: cost,
      },
      update: {
        totalRequests: { increment: 1 },
        totalTokens: { increment: tokens },
        totalCost: { increment: cost },
      },
    });
  } catch (error) {
    console.error('Failed to update usage stats:', error);
    // Don't throw - stats are optional
  }
}

/**
 * Get daily usage statistics
 */
export async function getDailyUsageStats(date?: Date): Promise<{
  date: Date;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
} | null> {
  const targetDate = date || new Date();
  targetDate.setHours(0, 0, 0, 0);

  try {
    const stats = await prisma.aIUsageStats.findUnique({
      where: { date: targetDate },
    });

    return stats;
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return null;
  }
}

/**
 * Get usage statistics for date range
 */
export async function getUsageStatsRange(
  startDate: Date,
  endDate: Date
): Promise<Array<{
  date: Date;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
}>> {
  try {
    return await prisma.aIUsageStats.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  } catch (error) {
    console.error('Failed to get usage stats range:', error);
    return [];
  }
}
