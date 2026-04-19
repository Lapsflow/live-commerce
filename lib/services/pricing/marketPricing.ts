/**
 * Market Pricing Service
 * Unified service for fetching and caching marketplace pricing data
 */

import { createNaverShoppingClient, NaverProductSummary } from '@/lib/marketplaces/naver';
import { createCoupangClient, CoupangProductSummary } from '@/lib/marketplaces/coupang';
import {
  getCached,
  setCached,
  CACHE_KEYS,
  CACHE_TTL,
} from '@/lib/cache/redis';
import { prisma } from '@/lib/db/prisma';

export interface UnifiedPricing {
  barcode: string;
  naver: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    count: number;
    products: any[];
  } | null;
  coupang: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    count: number;
    products: any[];
  } | null;
  market: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
  };
  competitiveness: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  fetchedAt: Date;
  cached: boolean;
}

export interface PricingOptions {
  ourPrice?: number;
  skipCache?: boolean;
  storeInDb?: boolean;
}

/**
 * Get unified pricing from Naver + Coupang
 */
export async function getPricing(
  barcode: string,
  options: PricingOptions = {}
): Promise<UnifiedPricing> {
  const { ourPrice, skipCache = false, storeInDb = true } = options;

  // 1. Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = await getCached<UnifiedPricing>(CACHE_KEYS.UNIFIED_PRICING(barcode));
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }
  }

  // 2. Fetch from both marketplaces in parallel
  const [naverResult, coupangResult] = await Promise.all([
    fetchNaverPricing(barcode, skipCache),
    fetchCoupangPricing(barcode, skipCache),
  ]);

  // 3. Calculate unified statistics
  const allPrices: number[] = [];

  if (naverResult) {
    allPrices.push(
      naverResult.statistics.minPrice,
      naverResult.statistics.maxPrice
    );
  }

  if (coupangResult) {
    allPrices.push(
      coupangResult.statistics.minPrice,
      coupangResult.statistics.maxPrice
    );
  }

  const validPrices = allPrices.filter((p) => p > 0);

  const market = {
    minPrice: validPrices.length > 0 ? Math.min(...validPrices) : 0,
    maxPrice: validPrices.length > 0 ? Math.max(...validPrices) : 0,
    avgPrice:
      validPrices.length > 0
        ? Math.round(validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length)
        : 0,
  };

  // 4. Calculate competitiveness
  const competitiveness = ourPrice
    ? calculateCompetitiveness(
        ourPrice,
        market.minPrice,
        coupangResult?.statistics.minPrice,
        naverResult?.statistics.minPrice
      )
    : 'FAIR';

  const result: UnifiedPricing = {
    barcode,
    naver: naverResult
      ? {
          minPrice: naverResult.statistics.minPrice,
          maxPrice: naverResult.statistics.maxPrice,
          avgPrice: naverResult.statistics.avgPrice,
          count: naverResult.statistics.count,
          products: naverResult.products,
        }
      : null,
    coupang: coupangResult
      ? {
          minPrice: coupangResult.statistics.minPrice,
          maxPrice: coupangResult.statistics.maxPrice,
          avgPrice: coupangResult.statistics.avgPrice,
          count: coupangResult.statistics.count,
          products: coupangResult.products,
        }
      : null,
    market,
    competitiveness,
    fetchedAt: new Date(),
    cached: false,
  };

  // 5. Store in cache (6 hours TTL)
  await setCached(CACHE_KEYS.UNIFIED_PRICING(barcode), result, CACHE_TTL.PRICING);

  // 6. Store in database (optional)
  if (storeInDb) {
    await storePricingInDb(result);
  }

  return result;
}

/**
 * Fetch Naver pricing with cache
 */
async function fetchNaverPricing(
  barcode: string,
  skipCache: boolean = false
): Promise<NaverProductSummary | null> {
  // Check cache
  if (!skipCache) {
    const cached = await getCached<NaverProductSummary>(
      CACHE_KEYS.NAVER_PRICING(barcode)
    );
    if (cached) {
      return cached;
    }
  }

  try {
    const client = createNaverShoppingClient();
    const result = await client.getProductByBarcode(barcode);

    if (result) {
      // Cache result
      await setCached(CACHE_KEYS.NAVER_PRICING(barcode), result, CACHE_TTL.PRICING);
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch Naver pricing:', error);
    return null;
  }
}

/**
 * Fetch Coupang pricing with cache
 */
async function fetchCoupangPricing(
  barcode: string,
  skipCache: boolean = false
): Promise<CoupangProductSummary | null> {
  // Check cache
  if (!skipCache) {
    const cached = await getCached<CoupangProductSummary>(
      CACHE_KEYS.COUPANG_PRICING(barcode)
    );
    if (cached) {
      return cached;
    }
  }

  try {
    const client = createCoupangClient();
    const result = await client.getProductByBarcode(barcode);

    if (result) {
      // Cache result
      await setCached(CACHE_KEYS.COUPANG_PRICING(barcode), result, CACHE_TTL.PRICING);
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch Coupang pricing:', error);
    return null;
  }
}

/**
 * Calculate competitiveness based on PDF requirements:
 * - If we are the lowest price → EXCELLENT (강조)
 * - If we are 20%+ more expensive than Coupang → POOR (경고)
 * - Otherwise GOOD/FAIR based on market position
 */
function calculateCompetitiveness(
  ourPrice: number,
  marketMinPrice: number,
  coupangMinPrice?: number,
  naverMinPrice?: number
): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
  if (!ourPrice || ourPrice <= 0) {
    return 'FAIR';
  }

  // 1. PDF Requirement: 우리가 최저가면 → 강조 (EXCELLENT)
  const isLowestPrice =
    (!marketMinPrice || ourPrice <= marketMinPrice) &&
    (!coupangMinPrice || ourPrice <= coupangMinPrice) &&
    (!naverMinPrice || ourPrice <= naverMinPrice);

  if (isLowestPrice) {
    return 'EXCELLENT';
  }

  // 2. PDF Requirement: 쿠팡보다 20% 비싸면 → 경고 (POOR)
  if (coupangMinPrice && coupangMinPrice > 0) {
    const coupangRatio = ourPrice / coupangMinPrice;
    if (coupangRatio >= 1.2) {
      return 'POOR'; // 쿠팡보다 20% 이상 비쌈
    }
  }

  // 3. General market comparison
  if (marketMinPrice && marketMinPrice > 0) {
    const ratio = ourPrice / marketMinPrice;

    if (ratio <= 1.05) {
      return 'GOOD'; // 시장 최저가 대비 5% 이내
    } else if (ratio <= 1.15) {
      return 'FAIR'; // 시장 최저가 대비 15% 이내
    } else {
      return 'POOR'; // 시장 최저가 대비 15% 이상 비쌈
    }
  }

  return 'FAIR';
}

/**
 * Store pricing data in database
 */
async function storePricingInDb(pricing: UnifiedPricing): Promise<void> {
  try {
    // Store Naver data
    if (pricing.naver) {
      await prisma.marketPricing.create({
        data: {
          barcode: pricing.barcode,
          platform: 'naver',
          productName: pricing.naver.products[0]?.title || 'Unknown',
          productUrl: pricing.naver.products[0]?.link || '',
          minPrice: pricing.naver.minPrice,
          maxPrice: pricing.naver.maxPrice,
          avgPrice: pricing.naver.avgPrice,
          priceCount: pricing.naver.count,
          fetchedAt: pricing.fetchedAt,
        },
      });
    }

    // Store Coupang data
    if (pricing.coupang) {
      await prisma.marketPricing.create({
        data: {
          barcode: pricing.barcode,
          platform: 'coupang',
          productName: pricing.coupang.products[0]?.productName || 'Unknown',
          productUrl: pricing.coupang.products[0]?.productUrl || '',
          minPrice: pricing.coupang.minPrice,
          maxPrice: pricing.coupang.maxPrice,
          avgPrice: pricing.coupang.avgPrice,
          priceCount: pricing.coupang.count,
          fetchedAt: pricing.fetchedAt,
        },
      });
    }
  } catch (error) {
    console.error('Failed to store pricing in database:', error);
    // Don't throw error - DB storage is optional
  }
}

/**
 * Search products across marketplaces
 */
export async function searchProducts(
  query: string,
  options: {
    marketplaces?: ('naver' | 'coupang')[];
    limit?: number;
  } = {}
): Promise<{
  naver: NaverProductSummary | null;
  coupang: CoupangProductSummary | null;
}> {
  const { marketplaces = ['naver', 'coupang'], limit = 20 } = options;

  const results = await Promise.all([
    marketplaces.includes('naver')
      ? (async () => {
          try {
            const client = createNaverShoppingClient();
            return await client.searchProducts(query, { display: limit });
          } catch (error) {
            console.error('Naver search failed:', error);
            return null;
          }
        })()
      : null,
    marketplaces.includes('coupang')
      ? (async () => {
          try {
            const client = createCoupangClient();
            return await client.searchProducts(query, { limit });
          } catch (error) {
            console.error('Coupang search failed:', error);
            return null;
          }
        })()
      : null,
  ]);

  return {
    naver: results[0],
    coupang: results[1],
  };
}
