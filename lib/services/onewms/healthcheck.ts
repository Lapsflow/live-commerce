/**
 * ONEWMS Stock Healthcheck Service
 *
 * On-demand match rate checker: samples random active HQ products
 * and compares DB totalStock vs ONEWMS realtime stock.
 */

import { prisma } from '@/lib/db/prisma';
import { getRealtimeStock } from './realtime';

export interface HealthcheckMismatch {
  productId: string;
  productCode: string;
  productName: string;
  dbStock: number;
  onewmsStock: number;
  difference: number;
}

export interface HealthcheckResult {
  sampleSize: number;
  matchCount: number;
  mismatchCount: number;
  errorCount: number;
  matchRate: number;
  topMismatches: HealthcheckMismatch[];
  durationMs: number;
  checkedAt: string;
}

interface SampleProduct {
  id: string;
  code: string;
  name: string;
  onewmsCode: string;
  totalStock: number;
}

const SAMPLE_SIZE = 100;
const BATCH_SIZE = 20;
const MATCH_THRESHOLD = 5; // |diff| <= 5 is considered a match

/**
 * Run stock healthcheck: sample random HQ products, compare DB vs ONEWMS
 */
export async function runHealthcheck(): Promise<HealthcheckResult> {
  const startTime = Date.now();
  const checkedAt = new Date().toISOString();

  // 1. Random sample of active HQ products with onewmsCode
  const samples = await prisma.$queryRaw<SampleProduct[]>`
    SELECT id, code, name, "onewmsCode", "totalStock"
    FROM "Product"
    WHERE "productType" = 'HEADQUARTERS'
      AND "isActive" = true
      AND "onewmsCode" IS NOT NULL
    ORDER BY random()
    LIMIT ${SAMPLE_SIZE}
  `;

  if (samples.length === 0) {
    return {
      sampleSize: 0,
      matchCount: 0,
      mismatchCount: 0,
      errorCount: 0,
      matchRate: 100,
      topMismatches: [],
      durationMs: Date.now() - startTime,
      checkedAt,
    };
  }

  // 2. Batch fetch ONEWMS stock (20 per batch, parallel within batch)
  let matchCount = 0;
  let errorCount = 0;
  const mismatches: HealthcheckMismatch[] = [];

  for (let i = 0; i < samples.length; i += BATCH_SIZE) {
    const batch = samples.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (product) => {
        const onewmsStock = await getRealtimeStock(product.onewmsCode, {
          skipCache: true,
        });
        return { product, onewmsStock };
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        errorCount++;
        continue;
      }

      const { product, onewmsStock } = result.value;

      if (onewmsStock === null) {
        errorCount++;
        continue;
      }

      const diff = Math.abs(product.totalStock - onewmsStock);

      if (diff <= MATCH_THRESHOLD) {
        matchCount++;
      } else {
        mismatches.push({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          dbStock: product.totalStock,
          onewmsStock,
          difference: onewmsStock - product.totalStock,
        });
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < samples.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 3. Sort mismatches by absolute difference descending, take top 10
  mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  const topMismatches = mismatches.slice(0, 10);

  const compared = samples.length - errorCount;
  const matchRate = compared > 0 ? Math.round((matchCount / compared) * 1000) / 10 : 0;

  return {
    sampleSize: samples.length,
    matchCount,
    mismatchCount: mismatches.length,
    errorCount,
    matchRate,
    topMismatches,
    durationMs: Date.now() - startTime,
    checkedAt,
  };
}
