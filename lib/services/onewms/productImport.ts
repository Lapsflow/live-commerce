/**
 * ONEWMS Product Import Service
 * Imports products from ONEWMS API into platform DB and syncs stock
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import type { ProductInfo } from '@/lib/onewms/types';

interface ImportProductsResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  duplicateBarcodes: number;
  errorDetails: Array<{ productId: string; error: string }>;
}

interface SyncStockResult {
  total: number;
  synced: number;
  errors: number;
  errorDetails: Array<{ productId: string; error: string }>;
}

/**
 * Build a map of barcode -> product_id[] to detect duplicates
 */
function buildBarcodeMap(products: ProductInfo[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of products) {
    const barcode = p.barcode?.trim();
    const productId = p.product_id;
    if (!barcode || !productId) continue;
    const existing = map.get(barcode) || [];
    existing.push(productId);
    map.set(barcode, existing);
  }
  return map;
}

/**
 * Import all products from ONEWMS into the platform database.
 * - Fetches all products via paginated getProductList()
 * - Handles barcode duplicates: first product keeps original, others get "{barcode}-{product_id}"
 * - Upserts by onewmsCode (ONEWMS product_id)
 */
export async function importProductsFromOnewms(): Promise<ImportProductsResult> {
  const result: ImportProductsResult = {
    total: 0,
    created: 0,
    updated: 0,
    errors: 0,
    duplicateBarcodes: 0,
    errorDetails: [],
  };

  const client = createOnewmsClient();

  // Step 1: Fetch all products (paginated)
  const allProducts: ProductInfo[] = [];
  let page = 1;
  const limit = 1000;

  while (true) {
    const { data, total } = await client.getProductList(page, limit);
    allProducts.push(...data);
    console.log(`Fetched page ${page}: ${data.length} products (total: ${total})`);
    if (data.length < limit || allProducts.length >= total) break;
    page++;
  }

  result.total = allProducts.length;
  console.log(`Total ONEWMS products to import: ${result.total}`);

  // Step 2: Build barcode duplicate map
  const barcodeMap = buildBarcodeMap(allProducts);
  const duplicateBarcodes = new Set<string>();
  for (const [barcode, ids] of barcodeMap.entries()) {
    if (ids.length > 1) {
      duplicateBarcodes.add(barcode);
    }
  }
  result.duplicateBarcodes = duplicateBarcodes.size;
  console.log(`Barcode duplicates detected: ${duplicateBarcodes.size} groups`);

  // Track which barcodes have been assigned to first product (original barcode)
  const assignedOriginalBarcode = new Set<string>();

  // Step 3: Upsert each product
  for (const p of allProducts) {
    const onewmsCode = p.product_id;
    if (!onewmsCode) {
      result.errors++;
      result.errorDetails.push({ productId: 'unknown', error: 'Missing product_id' });
      continue;
    }

    try {
      const originalBarcode = p.barcode?.trim() || '';
      let dbBarcode: string;

      // Handle barcode duplicates
      if (duplicateBarcodes.has(originalBarcode) && assignedOriginalBarcode.has(originalBarcode)) {
        // Not the first product with this barcode - use suffixed version
        dbBarcode = `${originalBarcode}-${onewmsCode}`;
      } else {
        // First product or unique barcode - use original
        dbBarcode = originalBarcode;
        if (duplicateBarcodes.has(originalBarcode)) {
          assignedOriginalBarcode.add(originalBarcode);
        }
      }

      // Fallback for empty barcode
      if (!dbBarcode) {
        dbBarcode = `WMS-NOBC-${onewmsCode}`;
      }

      const sellPrice = parseInt(String(p.shop_price || '0'), 10) || 0;
      const supplyPrice = parseInt(String(p.supply_price || '0'), 10) || 0;
      const productName = p.name || `WMS Product ${onewmsCode}`;
      const code = `WMS-${onewmsCode}`;

      // Check if existing product already has this code
      const existing = await prisma.product.findUnique({
        where: { onewmsCode },
        select: { id: true },
      });

      await prisma.product.upsert({
        where: { onewmsCode },
        create: {
          code,
          name: productName,
          barcode: dbBarcode,
          sellPrice,
          supplyPrice,
          onewmsCode,
          onewmsBarcode: originalBarcode || null,
          productType: 'HEADQUARTERS',
          isWmsProduct: true,
        },
        update: {
          name: productName,
          sellPrice,
          supplyPrice,
          onewmsBarcode: originalBarcode || null,
        },
      });

      if (existing) {
        result.updated++;
      } else {
        result.created++;
      }
    } catch (error) {
      result.errors++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errorDetails.push({ productId: onewmsCode, error: message });

      // Log but continue with next product
      console.error(`Failed to import product ${onewmsCode}:`, message);
    }
  }

  console.log(
    `Product import completed: ${result.created} created, ${result.updated} updated, ${result.errors} errors`
  );

  return result;
}

/**
 * Sync stock from ONEWMS for all imported products.
 * Simple update without conflict detection (use stockSync.ts for ongoing sync with conflict handling).
 */
export async function syncStockFromOnewms(): Promise<SyncStockResult> {
  const result: SyncStockResult = {
    total: 0,
    synced: 0,
    errors: 0,
    errorDetails: [],
  };

  // Get all products with onewmsCode
  const products = await prisma.product.findMany({
    where: { onewmsCode: { not: null } },
    select: { id: true, code: true, onewmsCode: true },
  });

  result.total = products.length;
  console.log(`Starting stock sync for ${result.total} products`);

  const client = createOnewmsClient();
  const batchSize = 10;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (product) => {
        try {
          const stockData = await client.getStockInfo('product_id', product.onewmsCode!);
          const stockEntry = stockData[product.onewmsCode!];

          let totalStock = 0;
          if (stockEntry?.stock) {
            for (const wh of Object.values(stockEntry.stock)) {
              totalStock += (wh.stock || 0);
            }
          }

          await prisma.product.update({
            where: { id: product.id },
            data: { totalStock },
          });

          return { success: true, productId: product.id };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, productId: product.id, error: message };
        }
      })
    );

    for (const r of results) {
      if (r.success) {
        result.synced++;
      } else {
        result.errors++;
        result.errorDetails.push({ productId: r.productId, error: r.error || 'Unknown' });
      }
    }

    // Rate limit delay between batches
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(
    `Stock sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`
  );

  return result;
}
