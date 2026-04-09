/**
 * ONEWMS Stock Synchronization Service
 * Handles automatic stock sync with conflict detection and resolution
 */

import { prisma } from '@/lib/db';
import { createOnewmsClient } from '@/lib/onewms';

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
async function syncProductStock(productId: string): Promise<{
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

    // Fetch stock info from ONEWMS
    const client = createOnewmsClient();
    const stockInfo = await client.getStockInfo(product.onewmsCode);

    const onewmsAvailableQty = stockInfo.available_qty || 0;
    const onewmsTotalQty = stockInfo.total_qty || 0;
    const localQty = product.totalStock;

    // Calculate difference
    const difference = onewmsAvailableQty - localQty;

    // Create sync record
    await prisma.onewmsStockSync.create({
      data: {
        productId,
        productCode: product.onewmsCode,
        availableQty: onewmsAvailableQty,
        totalQty: onewmsTotalQty,
        localQty,
        difference,
        syncStatus: 'synced',
        syncedAt: new Date(),
      },
    });

    // Auto-resolve if difference is small (< 5 units)
    if (Math.abs(difference) < 5) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          totalStock: onewmsAvailableQty,
        },
      });

      console.log(
        `Auto-resolved stock for ${product.code}: ${localQty} → ${onewmsAvailableQty}`
      );

      return { success: true, conflict: false };
    }

    // Mark as conflict if difference is significant
    if (Math.abs(difference) >= 5) {
      await prisma.onewmsStockSync.updateMany({
        where: {
          productId,
          syncedAt: {
            gte: new Date(Date.now() - 60000), // Last 1 minute
          },
        },
        data: {
          syncStatus: 'conflict',
        },
      });

      console.log(
        `Conflict detected for ${product.code}: ONEWMS=${onewmsAvailableQty}, Local=${localQty}, Diff=${difference}`
      );

      return { success: true, conflict: true };
    }

    return { success: true, conflict: false };
  } catch (error: any) {
    console.error(`Stock sync failed for product ${productId}:`, error);
    return {
      success: false,
      conflict: false,
      error: error.message || 'Unknown error',
    };
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
    // Find all products with ONEWMS codes
    const products = await prisma.product.findMany({
      where: {
        onewmsCode: {
          not: null,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        onewmsCode: true,
      },
    });

    stats.totalProducts = products.length;
    console.log(`Starting stock sync for ${stats.totalProducts} products`);

    // Sync products in parallel (batches of 5 to avoid rate limits)
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map((product) => syncProductStock(product.id))
      );

      // Aggregate results
      results.forEach((result, index) => {
        if (result.success) {
          stats.synced++;
          if (result.conflict) {
            stats.conflicts++;
          }
        } else {
          stats.errors++;
          stats.errorDetails.push({
            productId: batch[index].id,
            error: result.error || 'Unknown error',
          });
        }
      });

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < products.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `Stock sync completed: ${stats.synced}/${stats.totalProducts} synced, ${stats.conflicts} conflicts, ${stats.errors} errors`
    );

    return stats;
  } catch (error: any) {
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
      SELECT DISTINCT ON (product_id)
        oss.id,
        oss."productId",
        oss."productCode",
        oss."availableQty",
        oss."localQty",
        oss.difference,
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
  } catch (error: any) {
    console.error('Failed to fetch stock conflicts:', error);
    throw error;
  }
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
  } catch (error: any) {
    console.error('Failed to resolve conflict:', error);
    return {
      success: false,
      error: error.message || 'Failed to resolve conflict',
    };
  }
}
