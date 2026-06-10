/**
 * ONEWMS Stock Synchronization Service
 * Handles automatic stock sync with conflict detection and resolution
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import type { ProductInfo, StockProductEntry } from '@/lib/onewms/types';
import { fetchAllOnewmsProducts } from './productImport';

/**
 * get_stock_info 응답 entry → 총재고/가용재고 계산 (공용)
 * 운영 검증 v8 (2026-05-25): 가용재고 = stock(총재고 합산) - ready_trans_stock(접수/송장 미출고)
 */
function extractQty(stockEntry: StockProductEntry | undefined): {
  availableQty: number;
  totalQty: number;
} {
  let totalQty = 0;
  if (stockEntry?.stock) {
    for (const wh of Object.values(stockEntry.stock)) {
      totalQty += Number(wh.stock) || 0;
    }
  }
  const readyTransQty = Number(stockEntry?.ready_trans_stock) || 0;
  return { availableQty: totalQty - readyTransQty, totalQty };
}

/** 변경된 상품 1건의 sync 적용 정보 */
interface ChangedStock {
  id: string;
  code: string;
  name: string;
  onewmsCode: string;
  availableQty: number;
  totalQty: number;
  localQty: number;
  difference: number;
}

/**
 * 변경분 일괄 적용: product.totalStock update + 이력 createMany 를 1 트랜잭션으로.
 *
 * 속도 개선 (2026-06-10, 운영 측 "반영 속도 우선" 방침):
 *   기존: 상품마다 findUnique + 이력 create + update = 3N DB 왕복, 이력은 무변경 건도 매 분 기록
 *   변경: 메모리 비교(이미 조회한 totalStock 재사용) → 변경분만 기록·적용
 *   이력 테이블 비대(분당 전 상품 수만큼 증가 → 13k 충돌 누적과 동일 패턴) 차단.
 */
async function applyChangedStocks(changed: ChangedStock[], logPrefix: string): Promise<void> {
  if (changed.length === 0) return;

  await prisma.$transaction([
    ...changed.map((c) =>
      prisma.product.update({
        where: { id: c.id },
        data: { totalStock: c.availableQty },
      })
    ),
    prisma.onewmsStockSync.createMany({
      data: changed.map((c) => ({
        productId: c.id,
        productCode: c.onewmsCode,
        availableQty: c.availableQty,
        totalQty: c.totalQty,
        localQty: c.localQty,
        difference: c.difference,
        syncStatus: 'synced',
        syncedAt: new Date(),
      })),
    }),
  ]);

  for (const c of changed) {
    if (Math.abs(c.difference) > 5) {
      console.warn(
        `[${logPrefix}_LARGE_DIFF] ${c.code} (${c.name}): ` +
          `Local=${c.localQty} → ONEWMS=${c.availableQty} (총=${c.totalQty}) 차이 ${c.difference > 0 ? '+' : ''}${c.difference}`
      );
    }
    if (c.availableQty < 10) {
      console.warn(`[LOW STOCK ALERT] ${c.code} (${c.name}): ${c.availableQty} units`);
    }
  }
}

interface SyncStatsResult {
  totalProducts: number;
  synced: number;
  conflicts: number;
  errors: number;
  errorDetails: Array<{ productId: string; error: string }>;
}

interface ConflictInfo {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  onewmsQty: number;
  localQty: number;
  difference: number;
  syncedAt: Date;
}

/**
 * Sync stock for a single product
 */
export async function syncProductStock(productId: string): Promise<{
  success: boolean;
  conflict: boolean;
  error?: string;
}> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, conflict: false, error: 'Product not found' };
    }

    if (!product.onewmsCode) {
      return {
        success: false,
        conflict: false,
        error: 'Product missing ONEWMS code',
      };
    }

    // Fetch stock info from ONEWMS using product_id type with ids param
    // 운영 검증 v8 (2026-05-25): include_ready_trans=1 옵션 필수.
    // ONEWMS UI 가 표시하는 "가용재고" = stock(총재고) - ready_trans_stock(접수/송장 미출고).
    // 옵션 미전송 시 ready_trans_stock 필드를 못 받아 가용재고 계산 불가 → 오버셀 위험.
    const client = createOnewmsClient();
    const stockData = await client.getStockInfo('product_id', product.onewmsCode, {
      include_ready_trans: '1',
    });

    // Response: { [product_id]: { product_id, ..., stock: {wh1: {stock}}, ready_trans_stock?: string } }
    const stockEntry = stockData[product.onewmsCode];
    // 총재고 = 모든 warehouse 합산
    let onewmsTotalQty = 0;
    if (stockEntry?.stock) {
      for (const wh of Object.values(stockEntry.stock)) {
        onewmsTotalQty += Number(wh.stock) || 0;
      }
    }
    // 접수/송장 미출고 재고 (ONEWMS 가 옵션 전송 시에만 응답에 포함)
    const readyTransQty = Number(stockEntry?.ready_trans_stock) || 0;
    // 가용재고 = 총재고 - 미출고 (ONEWMS UI 와 동일, 셀러가 실제로 판매 가능한 수량)
    const onewmsAvailableQty = onewmsTotalQty - readyTransQty;
    const localQty = product.totalStock;

    // Calculate difference (가용재고 기준)
    const difference = onewmsAvailableQty - localQty;

    // Create sync record (총재고와 가용재고 모두 기록)
    await prisma.onewmsStockSync.create({
      data: {
        productId,
        productCode: product.onewmsCode,
        availableQty: onewmsAvailableQty,  // 가용재고 (UI 값)
        totalQty: onewmsTotalQty,          // 총재고 (창고 합산)
        localQty,
        difference,
        syncStatus: 'synced',
        syncedAt: new Date(),
      },
    });

    // ─────────────────────────────────────────────────────────────
    // 정책: ONEWMS 100% 일치 (2026-05-13 대표님 결정 — 옵션 A)
    //   PDF v2 원칙 "본사 WMS 자동 동기화 / 데이터 100% 본사 보유" 충실 이행.
    //   모든 차이를 ONEWMS 값으로 자동 적용. conflict 상태 생성 안 함.
    //   단, 큰 차이(절댓값 > 5) 는 알람 로그로 추적 가능하게 남김.
    // ─────────────────────────────────────────────────────────────

    // 차이가 없으면 그대로 종료
    if (difference === 0) {
      return { success: true, conflict: false };
    }

    // ONEWMS 값으로 자동 덮어쓰기
    await prisma.product.update({
      where: { id: productId },
      data: { totalStock: onewmsAvailableQty },
    });

    // 큰 차이는 알람 로그 (운영 모니터링용)
    if (Math.abs(difference) > 5) {
      console.warn(
        `[LARGE_DIFF_AUTO_APPLIED] ${product.code} (${product.name}): ` +
          `Local=${localQty} → ONEWMS=${onewmsAvailableQty} (차이 ${difference > 0 ? '+' : ''}${difference})`
      );
    } else {
      console.log(
        `Auto-applied stock for ${product.code}: ${localQty} → ${onewmsAvailableQty}`
      );
    }

    // Low stock alert
    if (onewmsAvailableQty < 10) {
      console.warn(
        `[LOW STOCK ALERT] Product ${product.code} (${product.name}) has low stock: ${onewmsAvailableQty} units`
      );
    }

    // 항상 자동 적용이므로 conflict 는 false
    return { success: true, conflict: false };
  } catch (error) {
    console.error(`Stock sync failed for product ${productId}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      conflict: false,
      error: message,
    };
  }
}

/**
 * 특정 productId 들만 batch sync (발주 등록 시점 즉시 sync 용)
 *
 * 차이점:
 *   - syncAllStocks: 모든 HEADQUARTERS 활성 상품
 *   - syncStocksForProducts: 호출자가 지정한 productId 만
 *
 * 정책: 100% ONEWMS 일치 (옵션 A) — 동일
 */
export async function syncStocksForProducts(productIds: string[]): Promise<SyncStatsResult> {
  const stats: SyncStatsResult = {
    totalProducts: 0,
    synced: 0,
    conflicts: 0,
    errors: 0,
    errorDetails: [],
  };

  if (productIds.length === 0) return stats;

  try {
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        productType: 'HEADQUARTERS',
        onewmsCode: { not: null },
      },
      // 속도 개선(2026-06-10): totalStock 을 함께 조회 → 루프 안 findUnique 제거
      select: { id: true, code: true, name: true, onewmsCode: true, totalStock: true },
    });

    stats.totalProducts = products.length;
    if (products.length === 0) return stats;

    const client = createOnewmsClient();
    const batchSize = 100;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const ids = batch.map((p) => p.onewmsCode!).join(',');

      try {
        // 운영 검증 v8: include_ready_trans=1 필수 (가용재고 계산용 ready_trans_stock 응답)
        const stockData = await client.getStockInfo('product_id', ids, { include_ready_trans: '1' }, { timeoutMs: 30000 });

        // 메모리 비교 → 변경분만 모아서 1 트랜잭션 적용
        const changed: ChangedStock[] = [];
        for (const product of batch) {
          const { availableQty, totalQty } = extractQty(stockData[product.onewmsCode!]);
          const difference = availableQty - product.totalStock;
          if (difference !== 0) {
            changed.push({
              id: product.id,
              code: product.code,
              name: product.name,
              onewmsCode: product.onewmsCode!,
              availableQty,
              totalQty,
              localQty: product.totalStock,
              difference,
            });
          }
        }

        await applyChangedStocks(changed, 'ORDER_PRESYNC');
        stats.synced += batch.length;
      } catch (batchErr) {
        for (const product of batch) {
          stats.errors++;
          stats.errorDetails.push({
            productId: product.id,
            error: batchErr instanceof Error ? batchErr.message : 'Batch API call failed',
          });
        }
      }
    }

    return stats;
  } catch (error: unknown) {
    console.error('syncStocksForProducts failed:', error);
    throw error;
  }
}

/**
 * Sync all products with ONEWMS stock data
 */
export async function syncAllStocks(): Promise<SyncStatsResult> {
  const stats: SyncStatsResult = {
    totalProducts: 0,
    synced: 0,
    conflicts: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // Find active HQ products with ONEWMS codes only
    const products = await prisma.product.findMany({
      where: {
        productType: 'HEADQUARTERS',
        isActive: true,
        onewmsCode: { not: null },
      },
      // 속도 개선(2026-06-10): totalStock 을 함께 조회 → 루프 안 findUnique 제거
      select: {
        id: true,
        code: true,
        name: true,
        onewmsCode: true,
        totalStock: true,
      },
    });

    stats.totalProducts = products.length;
    console.log(`Starting BATCH stock sync for ${stats.totalProducts} products (HEADQUARTERS + active)`);

    // Batch sync — ONEWMS get_stock_info API 는 ids 콤마 구분 다중 조회 지원
    // 한 번에 100개씩 묶어서 호출 → API 호출 수 1/100
    const batchSize = 100;
    const batchDelayMs = 300;
    const client = createOnewmsClient();

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const ids = batch.map((p) => p.onewmsCode!).join(',');

      try {
        // 운영 검증 v8: include_ready_trans=1 필수
        // 1회 API 호출로 batch 전체 재고 + 미출고 분리 정보 동시 조회
        const stockData = await client.getStockInfo('product_id', ids, { include_ready_trans: '1' });

        // 메모리 비교 → 변경분만 모아서 1 트랜잭션 적용 (100% ONEWMS 가용재고 일치 정책 동일)
        const changed: ChangedStock[] = [];
        for (const product of batch) {
          const { availableQty, totalQty } = extractQty(stockData[product.onewmsCode!]);
          const difference = availableQty - product.totalStock;
          if (difference !== 0) {
            changed.push({
              id: product.id,
              code: product.code,
              name: product.name,
              onewmsCode: product.onewmsCode!,
              availableQty,
              totalQty,
              localQty: product.totalStock,
              difference,
            });
          }
        }

        await applyChangedStocks(changed, 'LARGE_DIFF_AUTO_APPLIED');
        stats.synced += batch.length;
      } catch (batchErr) {
        console.error('Batch sync failed for batch starting at', i, ':', batchErr);
        // batch 단위 실패 → batch 안의 모든 상품을 error로 기록
        for (const product of batch) {
          stats.errors++;
          stats.errorDetails.push({
            productId: product.id,
            error: batchErr instanceof Error ? batchErr.message : 'Batch API call failed',
          });
        }
      }

      // Progress log
      console.log(
        `  Batch progress: ${Math.min(i + batchSize, products.length)}/${products.length}`
      );

      // Small delay between batches
      if (i + batchSize < products.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }

    console.log(
      `Batch stock sync completed: ${stats.synced}/${stats.totalProducts} synced, ${stats.errors} errors`
    );

    return stats;
  } catch (error) {
    console.error('Stock sync failed:', error);
    throw error;
  }
}

/**
 * Get all unresolved stock conflicts
 */
export async function getStockConflicts(): Promise<ConflictInfo[]> {
  try {
    // Get latest sync record for each product with conflicts
    const conflicts = await prisma.$queryRaw<
      Array<{
        id: string;
        productId: string;
        productCode: string;
        availableQty: number;
        localQty: number;
        difference: number;
        syncedAt: Date;
      }>
    >`
      SELECT DISTINCT ON ("productId")
        oss.id,
        oss."productId",
        oss."productCode",
        oss."availableQty",
        oss."localQty",
        oss."difference",
        oss."syncedAt"
      FROM "OnewmsStockSync" oss
      WHERE oss."syncStatus" = 'conflict'
      ORDER BY oss."productId", oss."syncedAt" DESC
    `;

    // Fetch product names
    const productIds = conflicts.map((c) => c.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return conflicts.map((conflict) => ({
      id: conflict.id,
      productId: conflict.productId,
      productCode: conflict.productCode,
      productName: productMap.get(conflict.productId) || 'Unknown',
      onewmsQty: conflict.availableQty,
      localQty: conflict.localQty,
      difference: conflict.difference,
      syncedAt: conflict.syncedAt,
    }));
  } catch (error) {
    console.error('Failed to fetch stock conflicts:', error);
    throw error;
  }
}

/**
 * Deactivate HEADQUARTERS products not found in ONEWMS, restore those that reappear.
 * CENTER products are NEVER touched.
 *
 * @param prefetchedProducts - fetchAllOnewmsProducts() 결과 주입 시 재스캔 생략
 */
export async function deactivateOrphanProducts(prefetchedProducts?: ProductInfo[]): Promise<{
  deactivated: number;
  restored: number;
  alreadyCorrect: number;
  onewmsTotal: number;
  dbTotal: number;
}> {
  const result = { deactivated: 0, restored: 0, alreadyCorrect: 0, onewmsTotal: 0, dbTotal: 0 };

  // 1. Fetch all ONEWMS product IDs (속도 개선 2026-06-10: prefetched 공유 가능)
  const productList = prefetchedProducts ?? (await fetchAllOnewmsProducts());
  const onewmsProductIds = new Set<string>();
  for (const p of productList) {
    if (p.product_id) onewmsProductIds.add(p.product_id);
  }
  result.onewmsTotal = onewmsProductIds.size;

  // 2. Get all HEADQUARTERS products with onewmsCode
  const hqProducts = await prisma.product.findMany({
    where: {
      productType: 'HEADQUARTERS',
      onewmsCode: { not: null },
    },
    select: { id: true, code: true, name: true, barcode: true, onewmsCode: true, isActive: true },
  });
  result.dbTotal = hqProducts.length;

  // 3. Classify and apply
  for (const product of hqProducts) {
    const existsInOnewms = onewmsProductIds.has(product.onewmsCode!);

    if (!existsInOnewms && product.isActive) {
      // Deactivate orphan
      await prisma.product.update({
        where: { id: product.id },
        data: { isActive: false },
      });
      await prisma.auditLog.create({
        data: {
          userId: null,
          userName: '시스템',
          userRole: 'MASTER',
          action: 'UPDATE',
          entityType: 'PRODUCT',
          entityId: product.id,
          entityName: `${product.barcode} (${product.name})`,
          before: { isActive: true },
          after: { isActive: false },
          diff: { isActive: { from: true, to: false }, reason: 'onewms_orphan' },
          ipAddress: 'cron',
          userAgent: 'stock-sync-cron/1.0',
          description: 'ONEWMS에서 삭제된 본사 상품 자동 비활성화',
        },
      });
      result.deactivated++;
    } else if (existsInOnewms && !product.isActive) {
      // Restore reappeared product
      await prisma.product.update({
        where: { id: product.id },
        data: { isActive: true },
      });
      await prisma.auditLog.create({
        data: {
          userId: null,
          userName: '시스템',
          userRole: 'MASTER',
          action: 'UPDATE',
          entityType: 'PRODUCT',
          entityId: product.id,
          entityName: `${product.barcode} (${product.name})`,
          before: { isActive: false },
          after: { isActive: true },
          diff: { isActive: { from: false, to: true }, reason: 'onewms_restored' },
          ipAddress: 'cron',
          userAgent: 'stock-sync-cron/1.0',
          description: 'ONEWMS에 다시 나타난 본사 상품 자동 복구',
        },
      });
      result.restored++;
    } else {
      result.alreadyCorrect++;
    }
  }

  console.log(
    `Orphan check: ${result.deactivated} deactivated, ${result.restored} restored, ${result.alreadyCorrect} correct (ONEWMS: ${result.onewmsTotal}, DB: ${result.dbTotal})`
  );

  return result;
}

/**
 * Resolve a stock conflict by choosing ONEWMS or local quantity
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'onewms' | 'local' | 'ignore'
): Promise<{ success: boolean; error?: string }> {
  try {
    const conflict = await prisma.onewmsStockSync.findUnique({
      where: { id: conflictId },
      include: {
        product: true,
      },
    });

    if (!conflict) {
      return { success: false, error: 'Conflict not found' };
    }

    if (conflict.syncStatus !== 'conflict') {
      return { success: false, error: 'Not a conflict record' };
    }

    switch (resolution) {
      case 'onewms':
        // Use ONEWMS quantity
        await prisma.product.update({
          where: { id: conflict.productId },
          data: {
            totalStock: conflict.availableQty,
          },
        });
        break;

      case 'local':
        // Keep local quantity (no update needed)
        break;

      case 'ignore':
        // Mark as resolved without changes
        break;
    }

    // Mark conflict as resolved
    await prisma.onewmsStockSync.update({
      where: { id: conflictId },
      data: {
        syncStatus: 'resolved',
      },
    });

    console.log(
      `Resolved conflict ${conflictId} for product ${conflict.product.code} with resolution: ${resolution}`
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve conflict';

    return {
      success: false,
      error: message,
    };
  }
}
