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

// 속도 개선(2026-06-10, 운영 측 "반영 속도 우선" 방침): 3분 → 1분.
// 출고 기준 재고 정책이므로 캐시로 인한 오차 위험보다 표시 신선도 우선.
// 발주/바코드는 기존대로 skipCache=true 강제 갱신이라 영향 없음.
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
 * @param options.skipCache - true면 캐시 무시, 직접 ONEWMS 호출
 * @returns ONEWMS 가용 재고 (전 창고 합산), null if failed
 */
export async function getRealtimeStock(
  onewmsCode: string,
  options?: { skipCache?: boolean }
): Promise<number | null> {
  // 1. Check cache (skip if forced refresh)
  if (!options?.skipCache) {
    const cached = getCached(onewmsCode);
    if (cached !== null) return cached;
  }

  // 2. Fetch from ONEWMS
  // 운영 검증 v8 (2026-05-25): include_ready_trans=1 필수.
  // 가용재고 = stock(총재고) - ready_trans_stock(접수/송장 미출고).
  // 옵션 미전송 시 총재고만 받아 오버셀 위험.
  try {
    const client = createOnewmsClient();
    const stockData = await client.getStockInfo('product_id', onewmsCode, {
      include_ready_trans: '1',
    });

    const entry = stockData[onewmsCode];
    // 총재고 (모든 warehouse 합산)
    let totalOnewms = 0;
    if (entry?.stock) {
      for (const wh of Object.values(entry.stock)) {
        totalOnewms += Number(wh.stock) || 0;
      }
    }
    // 접수/송장 미출고 차감 → 가용재고 (ONEWMS UI 와 동일)
    const readyTrans = Number(entry?.ready_trans_stock) || 0;
    const availableStock = totalOnewms - readyTrans;

    setCache(onewmsCode, availableStock);
    return availableStock;
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

  // 속도 개선(2026-06-10): 상품당 1회 호출(20개 병렬 × 반복) → ids 콤마 구분 1회 호출.
  // get_stock_info 는 다중 조회를 지원 (stockSync batch 와 동일 패턴, 운영 검증된 방식).
  // 상품 100개 기준 API 호출 100회 → 1회. 방송 시작·발주 화면 즉시 체감.
  const client = createOnewmsClient();
  const BATCH_SIZE = 100;
  for (let i = 0; i < uncachedCodes.length; i += BATCH_SIZE) {
    const batch = uncachedCodes.slice(i, i + BATCH_SIZE);

    try {
      // 운영 검증 v8: include_ready_trans=1 필수 (가용재고 = 총재고 - 접수/송장 미출고)
      const stockData = await client.getStockInfo('product_id', batch.join(','), {
        include_ready_trans: '1',
      });

      for (const code of batch) {
        const entry = stockData[code];
        let totalOnewms = 0;
        if (entry?.stock) {
          for (const wh of Object.values(entry.stock)) {
            totalOnewms += Number(wh.stock) || 0;
          }
        }
        const readyTrans = Number(entry?.ready_trans_stock) || 0;
        const availableStock = totalOnewms - readyTrans;

        setCache(code, availableStock);
        results.set(code, availableStock);
      }
    } catch (error) {
      console.error('[REALTIME] Batch stock fetch failed:', error);
      // API 실패 시 해당 batch 전체 null (호출자가 DB 폴백 처리)
      for (const code of batch) {
        results.set(code, null);
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
