/**
 * Market Pricing Service
 * Unified service for fetching and caching marketplace pricing data (Naver only)
 */

import { createNaverShoppingClient, NaverProductSummary } from '@/lib/marketplaces/naver';
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
 * Get unified pricing from Naver
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

  // 2. Look up product name from DB for marketplace search
  // Barcode numbers don't return results on Naver — product names do
  let searchQuery = barcode;
  try {
    const product = await prisma.product.findUnique({
      where: { barcode },
      select: { name: true },
    });
    if (product?.name) {
      // Strip leading "[1234] " prefixes from product names
      searchQuery = product.name.replace(/^\[\d+\]\s*/, '').trim() || barcode;
    }
  } catch {
    // Fallback to barcode if DB lookup fails
  }

  // 3. Fetch from Naver
  const naverResult = await fetchNaverPricing(searchQuery, skipCache, barcode);

  // 4. Calculate market statistics
  const market = naverResult
    ? {
        minPrice: naverResult.statistics.minPrice,
        maxPrice: naverResult.statistics.maxPrice,
        avgPrice: naverResult.statistics.avgPrice,
      }
    : { minPrice: 0, maxPrice: 0, avgPrice: 0 };

  // 5. Calculate competitiveness
  const competitiveness = ourPrice
    ? calculateCompetitiveness(ourPrice, market.minPrice, naverResult?.statistics.minPrice)
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
    market,
    competitiveness,
    fetchedAt: new Date(),
    cached: false,
  };

  // 6. Store in cache (6 hours TTL)
  await setCached(CACHE_KEYS.UNIFIED_PRICING(barcode), result, CACHE_TTL.PRICING);

  // 7. Store in database (optional)
  if (storeInDb) {
    await storePricingInDb(result);
  }

  return result;
}

/**
 * Fetch Naver pricing with cache
 */
async function fetchNaverPricing(
  searchQuery: string,
  skipCache: boolean = false,
  cacheKey?: string
): Promise<NaverProductSummary | null> {
  const key = cacheKey || searchQuery;
  // Check cache
  if (!skipCache) {
    const cached = await getCached<NaverProductSummary>(
      CACHE_KEYS.NAVER_PRICING(key)
    );
    if (cached) {
      return cached;
    }
  }

  try {
    const client = createNaverShoppingClient();
    const result = await client.searchProducts(searchQuery, { display: 10, sort: 'sim' });

    if (result && result.products.length > 0) {
      // Cache result using barcode as key
      await setCached(CACHE_KEYS.NAVER_PRICING(key), result, CACHE_TTL.PRICING);
      return result;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch Naver pricing:', error);
    return null;
  }
}

/**
 * Calculate competitiveness based on market position
 */
function calculateCompetitiveness(
  ourPrice: number,
  marketMinPrice: number,
  naverMinPrice?: number
): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
  if (!ourPrice || ourPrice <= 0) {
    return 'FAIR';
  }

  // 우리가 최저가면 → EXCELLENT
  const isLowestPrice =
    (!marketMinPrice || ourPrice <= marketMinPrice) &&
    (!naverMinPrice || ourPrice <= naverMinPrice);

  if (isLowestPrice) {
    return 'EXCELLENT';
  }

  // General market comparison
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
  } catch (error) {
    console.error('Failed to store pricing in database:', error);
  }
}

/**
 * Search products on Naver
 */
export async function searchProducts(
  query: string,
  options: {
    limit?: number;
  } = {}
): Promise<{
  naver: NaverProductSummary | null;
}> {
  const { limit = 20 } = options;

  let naverResult: NaverProductSummary | null = null;
  try {
    const client = createNaverShoppingClient();
    naverResult = await client.searchProducts(query, { display: limit });
  } catch (error) {
    console.error('Naver search failed:', error);
  }

  return {
    naver: naverResult,
  };
}
