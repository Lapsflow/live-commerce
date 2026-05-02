/**
 * ONEWMS Realtime Stock Helper
 *
 * Phase 2: 풀 실시간 전환
 * - getRealtimeStock(onewmsCode): 단건 실시간 조회 + 1분 캐시
 * - getRealtimeStockBatch(codes): 일괄 조회 (Promise.allSettled)
 * - getAvailableStock(productId): 실시간 재고 - 예약 차감
 */

import { createOnewmsClient } from '@/lib/onewms';
import { prisma } from '@/lib/db/prisma';

// ─── LRU Memory Cache (1-minute TTL) ───

interface CacheEntry {
  stock: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute
const CACHE_MAX_SIZE = 2000;
const stockCache = new Map<string, CacheEntry>();

function getCached(onewmsCode: string): number | null {
  const entry = stockCache.get(onewmsCode);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    stockCache.delete(onewmsCode);
    return null;
  }
  return entry.stock;
}

function setCache(onewmsCode: string, stock: number): void {
  // LRU eviction: remove oldest entries when at capacity
  if (stockCache.size >= CACHE_MAX_SIZE) {
    const firstKey = stockCache.keys().next().value;
    if (firstKey) stockCache.delete(firstKey);
  }
  stockCache.set(onewmsCode, { stock, fetchedAt: Date.now() });
}

/** Clear cache (for testing) */
export function clearRealtimeCache(): void {
  stockCache.clear();
}

// ─── Core Functions ───

/**
 * 단건 실시간 재고 조회 (1분 캐시)
 * @returns ONEWMS 가용 재고 (전 창고 합산), null if failed
 */
export async function getRealtimeStock(
  onewmsCode: string
): Promise<number | null> {
  // 1. Check cache
  const cached = getCached(onewmsCode);
  if (cached !== null) return cached;

  // 2. Fetch from ONEWMS
  try {
    const client = createOnewmsClient();
    const stockData = await client.getStockInfo('product_id', onewmsCode);

    const entry = stockData[onewmsCode];
    let totalStock = 0;
    if (entry?.stock) {
      for (const wh of Object.values(entry.stock)) {
        totalStock += Number(wh.stock) || 0;
      }
    }

    setCache(onewmsCode, totalStock);
    return totalStock;
  } catch (error) {
    console.error(`[REALTIME] Failed to fetch stock for ${onewmsCode}:`, error);
    return null;
  }
}

/**
 * 일괄 실시간 재고 조회 (Promise.allSettled)
 * @returns Map<onewmsCode, stock> — 실패한 건은 null
 */
export async function getRealtimeStockBatch(
  onewmsCodes: string[]
): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  if (onewmsCodes.length === 0) return results;

  // Deduplicate
  const uniqueCodes = [...new Set(onewmsCodes)];

  // Separate cached vs. uncached
  const uncachedCodes: string[] = [];
  for (const code of uniqueCodes) {
    const cached = getCached(code);
    if (cached !== null) {
      results.set(code, cached);
    } else {
      uncachedCodes.push(code);
    }
  }

  if (uncachedCodes.length === 0) return results;

  // Batch fetch — parallel per code (ONEWMS API is per-product_id)
  const BATCH_SIZE = 20;
  for (let i = 0; i < uncachedCodes.length; i += BATCH_SIZE) {
    const batch = uncachedCodes.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map(async (code) => {
        const stock = await getRealtimeStock(code);
        return { code, stock };
      })
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.code, result.value.stock);
      } else {
        // Find the code that failed (batch index)
        const idx = settled.indexOf(result);
        results.set(batch[idx], null);
      }
    }
  }

  return results;
}

/**
 * 상품 ID 기반 가용 재고 조회 (실시간 + 예약 차감)
 *
 * 본사 상품: ONEWMS 실시간 - reservedStock
 * 센터 상품: DB totalStock - reservedStock (ONEWMS 미연동)
 *
 * @returns { realtimeStock, reservedStock, availableStock } or null on failure
 */
export async function getAvailableStock(
  productId: string
): Promise<{
  realtimeStock: number;
  reservedStock: number;
  availableStock: number;
  source: 'onewms' | 'db';
} | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        onewmsCode: true,
        productType: true,
        totalStock: true,
        reservedStock: true,
      },
    });

    if (!product) return null;

    let realtimeStock: number;
    let source: 'onewms' | 'db';

    // 본사 상품 + onewmsCode 있으면 실시간 조회
    if (product.productType === 'HEADQUARTERS' && product.onewmsCode) {
      const onewmsStock = await getRealtimeStock(product.onewmsCode);
      if (onewmsStock !== null) {
        realtimeStock = onewmsStock;
        source = 'onewms';

        // Background DB cache update (non-blocking)
        prisma.product
          .update({
            where: { id: productId },
            data: { totalStock: onewmsStock },
          })
          .catch((e) =>
            console.error(`[REALTIME] DB cache update failed for ${productId}:`, e)
          );
      } else {
        // ONEWMS 장애 시 DB 폴백
        realtimeStock = product.totalStock;
        source = 'db';
        console.warn(`[REALTIME] ONEWMS fallback for ${productId}, using DB stock: ${product.totalStock}`);
      }
    } else {
      // 센터 상품 or onewmsCode 없음 → DB 기준
      realtimeStock = product.totalStock;
      source = 'db';
    }

    const availableStock = Math.max(0, realtimeStock - product.reservedStock);

    return {
      realtimeStock,
      reservedStock: product.reservedStock,
      availableStock,
      source,
    };
  } catch (error) {
    console.error(`[REALTIME] getAvailableStock failed for ${productId}:`, error);
    return null;
  }
}
