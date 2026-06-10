/**
 * ONEWMS Product Import Service
 * Imports products from ONEWMS API into platform DB and syncs stock.
 * Designed for Vercel Hobby 10s function limit: processes in batches per API call.
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
  page: number;
  hasMore: boolean;
  errorDetails: Array<{ productId: string; error: string }>;
}

interface SyncStockResult {
  total: number;
  synced: number;
  errors: number;
  offset: number;
  hasMore: boolean;
  errorDetails: Array<{ productId: string; error: string }>;
}

/**
 * Build a map of barcode -> product_id[] to detect duplicates within a batch.
 * Also checks DB for existing barcodes to avoid unique constraint violations.
 */
async function getExistingBarcodes(): Promise<Set<string>> {
  const existing = await prisma.product.findMany({
    select: { barcode: true },
  });
  return new Set(existing.map((p) => p.barcode));
}

/**
 * Import products from ONEWMS into the platform database (one page at a time).
 * Call repeatedly with incrementing page until hasMore=false.
 *
 * @param page - ONEWMS API page number (starts at 1)
 * @param limit - Products per page (default 100, safe for 10s limit)
 */
export async function importProductsFromOnewms(
  page = 1,
  limit = 100
): Promise<ImportProductsResult> {
  const result: ImportProductsResult = {
    total: 0,
    created: 0,
    updated: 0,
    errors: 0,
    duplicateBarcodes: 0,
    page,
    hasMore: false,
    errorDetails: [],
  };

  const client = createOnewmsClient();

  // Fetch one page of products
  const { data: products, total } = await client.getProductList(page, limit);
  result.total = products.length;
  result.hasMore = page * limit < total;

  console.log(`Fetched page ${page}: ${products.length} products (total in ONEWMS: ${total})`);

  if (products.length === 0) return result;

  // Build barcode duplicate map within this batch
  const barcodeCount = new Map<string, number>();
  for (const p of products) {
    const bc = p.barcode?.trim();
    if (bc) barcodeCount.set(bc, (barcodeCount.get(bc) || 0) + 1);
  }

  // Get existing barcodes in DB to avoid unique constraint violations
  const existingBarcodes = await getExistingBarcodes();

  for (const p of products) {
    const onewmsCode = p.product_id;
    if (!onewmsCode) {
      result.errors++;
      result.errorDetails.push({ productId: 'unknown', error: 'Missing product_id' });
      continue;
    }

    try {
      const originalBarcode = p.barcode?.trim() || '';
      const code = `WMS-${onewmsCode}`;
      const productName = p.name || `WMS Product ${onewmsCode}`;
      const sellPrice = parseInt(String(p.shop_price || '0'), 10) || 0;
      const supplyPrice = parseInt(String(p.supply_price || '0'), 10) || 0;
      const originalPrice = parseInt(String(p.org_price || '0'), 10) || 0;

      // Check if this product already exists in DB
      const existing = await prisma.product.findUnique({
        where: { onewmsCode },
        select: { id: true, barcode: true },
      });

      // Determine barcode for DB
      let dbBarcode: string;
      if (existing) {
        // Already in DB - keep existing barcode on update
        dbBarcode = existing.barcode;
      } else {
        // New product - assign barcode
        dbBarcode = originalBarcode || `WMS-NOBC-${onewmsCode}`;
        // If barcode already taken in DB, suffix with product_id
        if (existingBarcodes.has(dbBarcode)) {
          dbBarcode = `${originalBarcode}-${onewmsCode}`;
          result.duplicateBarcodes++;
        }
      }

      await prisma.product.upsert({
        where: { onewmsCode },
        create: {
          code,
          name: productName,
          barcode: dbBarcode,
          sellPrice,
          supplyPrice,
          originalPrice,
          onewmsCode,
          onewmsBarcode: originalBarcode || null,
          productType: 'HEADQUARTERS',
          isWmsProduct: true,
        },
        update: {
          name: productName,
          sellPrice,
          supplyPrice,
          originalPrice,
          onewmsBarcode: originalBarcode || null,
        },
      });

      // Track this barcode as used
      existingBarcodes.add(dbBarcode);

      if (existing) {
        result.updated++;
      } else {
        result.created++;
      }
    } catch (error) {
      result.errors++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errorDetails.push({ productId: onewmsCode, error: message });
      console.error(`Failed to import product ${onewmsCode}:`, message);
    }
  }

  console.log(
    `Product import page ${page}: ${result.created} created, ${result.updated} updated, ${result.errors} errors`
  );

  return result;
}

/**
 * Sync stock from ONEWMS for imported products (batch of N at a time).
 * Call repeatedly with incrementing offset until hasMore=false.
 *
 * @param offset - Skip first N products
 * @param limit - Products to sync in this batch (default 20)
 */
export async function syncStockFromOnewms(
  offset = 0,
  limit = 20
): Promise<SyncStockResult> {
  const result: SyncStockResult = {
    total: 0,
    synced: 0,
    errors: 0,
    offset,
    hasMore: false,
    errorDetails: [],
  };

  // Count total and get batch
  const totalCount = await prisma.product.count({
    where: { onewmsCode: { not: null } },
  });

  const products = await prisma.product.findMany({
    where: { onewmsCode: { not: null } },
    select: { id: true, code: true, onewmsCode: true },
    skip: offset,
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  result.total = totalCount;
  result.hasMore = offset + limit < totalCount;

  console.log(`Stock sync batch: offset=${offset}, count=${products.length}, total=${totalCount}`);

  if (products.length === 0) return result;

  const client = createOnewmsClient();

  // Process in small parallel batches of 5
  const batchSize = 5;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (product) => {
        try {
          // 운영 검증 v8: include_ready_trans=1 + 가용재고 차감 (stockSync.ts 와 동일 패턴)
          const stockData = await client.getStockInfo('product_id', product.onewmsCode!, {
            include_ready_trans: '1',
          });
          const stockEntry = stockData[product.onewmsCode!];

          let totalOnewms = 0;
          if (stockEntry?.stock) {
            for (const wh of Object.values(stockEntry.stock)) {
              totalOnewms += Number(wh.stock) || 0;
            }
          }
          const readyTrans = Number(stockEntry?.ready_trans_stock) || 0;
          const totalStock = totalOnewms - readyTrans;

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
  }

  console.log(
    `Stock sync batch done: ${result.synced}/${products.length} synced, ${result.errors} errors`
  );

  return result;
}

/**
 * ONEWMS 상품 목록 전체 스캔 (paginated) — 공용.
 *
 * 속도 개선(2026-06-10): 기존에는 가격 sync / auto-import / 고아 정리가 각자
 * 같은 목록을 전체 스캔 (1 cron 회차에 최대 60회 중복 API 호출).
 * 1회 스캔 결과를 공유하도록 추출. 호출자가 결과를 각 함수에 주입.
 */
export async function fetchAllOnewmsProducts(): Promise<ProductInfo[]> {
  const client = createOnewmsClient();
  const onewmsProducts: ProductInfo[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data: products, total } = await client.getProductList(page, 100);
    onewmsProducts.push(...products);
    if (page * 100 >= total) break;
  }
  return onewmsProducts;
}

/**
 * Auto-import NEW products from ONEWMS that don't exist in DB yet.
 * Called from product-sync cron to detect and register new ONEWMS products.
 * Only creates products with onewmsCode not yet in DB.
 *
 * @param prefetchedProducts - fetchAllOnewmsProducts() 결과 주입 시 재스캔 생략
 */
export async function autoImportNewProducts(prefetchedProducts?: ProductInfo[]): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  const result = { total: 0, created: 0, skipped: 0, errors: 0 };

  // Get all existing onewmsCodes in DB
  const existingProducts = await prisma.product.findMany({
    where: { onewmsCode: { not: null } },
    select: { onewmsCode: true, barcode: true },
  });
  const existingOnewmsCodes = new Set(existingProducts.map((p) => p.onewmsCode));
  const existingBarcodes = new Set(existingProducts.map((p) => p.barcode));

  const onewmsProducts = prefetchedProducts ?? (await fetchAllOnewmsProducts());

  result.total = onewmsProducts.length;

  // Filter to only new products
  const newProducts = onewmsProducts.filter(
    (p) => p.product_id && !existingOnewmsCodes.has(p.product_id)
  );

  if (newProducts.length === 0) {
    console.log(`[AUTO-IMPORT] No new products found (${result.total} total in ONEWMS)`);
    return result;
  }

  console.log(`[AUTO-IMPORT] Found ${newProducts.length} new products to import`);

  for (const p of newProducts) {
    const onewmsCode = p.product_id!;
    try {
      const originalBarcode = p.barcode?.trim() || '';
      const code = `WMS-${onewmsCode}`;
      const productName = p.name || `WMS Product ${onewmsCode}`;
      const sellPrice = parseInt(String(p.shop_price || '0'), 10) || 0;
      const supplyPrice = parseInt(String(p.supply_price || '0'), 10) || 0;
      const originalPrice = parseInt(String(p.org_price || '0'), 10) || 0;

      // Barcode dedup
      let dbBarcode = originalBarcode || `WMS-NOBC-${onewmsCode}`;
      if (existingBarcodes.has(dbBarcode)) {
        dbBarcode = `${originalBarcode}-${onewmsCode}`;
      }

      // Code dedup
      const existingCode = await prisma.product.findUnique({
        where: { code },
        select: { id: true },
      });
      const finalCode = existingCode ? `WMS-${onewmsCode}-${Date.now().toString(36)}` : code;

      await prisma.product.create({
        data: {
          code: finalCode,
          name: productName,
          barcode: dbBarcode,
          sellPrice,
          supplyPrice,
          originalPrice,
          onewmsCode,
          onewmsBarcode: originalBarcode || null,
          productType: 'HEADQUARTERS',
          isWmsProduct: true,
          isActive: true,
          autoCreated: true,
          autoCreatedAt: new Date(),
        },
      });

      existingBarcodes.add(dbBarcode);
      result.created++;
    } catch (error) {
      result.errors++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AUTO-IMPORT] Failed to create product ${onewmsCode}:`, message);
    }
  }

  result.skipped = result.total - newProducts.length;

  console.log(
    `[AUTO-IMPORT] Done: ${result.created} created, ${result.skipped} skipped (existing), ${result.errors} errors`
  );

  return result;
}

/**
 * Sync product prices (originalPrice, sellPrice, supplyPrice) from ONEWMS.
 * Only updates HEADQUARTERS products. CENTER products are never touched.
 * Called from stock-sync cron alongside stock sync.
 */
export async function syncProductPricesFromOnewms(prefetchedProducts?: ProductInfo[]): Promise<{
  total: number;
  updated: number;
  errors: number;
}> {
  const result = { total: 0, updated: 0, errors: 0 };

  // 속도 개선(2026-06-10): prefetched 목록 주입 시 재스캔 생략 (1회 스캔 공유)
  const productList = prefetchedProducts ?? (await fetchAllOnewmsProducts());
  const onewmsProducts = new Map<string, ProductInfo>();
  for (const p of productList) {
    if (p.product_id) onewmsProducts.set(p.product_id, p);
  }

  // Get all HEADQUARTERS products with onewmsCode
  const dbProducts = await prisma.product.findMany({
    where: {
      productType: 'HEADQUARTERS',
      onewmsCode: { not: null },
    },
    select: {
      id: true,
      onewmsCode: true,
      sellPrice: true,
      supplyPrice: true,
      originalPrice: true,
    },
  });

  result.total = dbProducts.length;

  for (const dbProduct of dbProducts) {
    const onewmsInfo = onewmsProducts.get(dbProduct.onewmsCode!);
    if (!onewmsInfo) continue;

    const newSellPrice = parseInt(String(onewmsInfo.shop_price || '0'), 10) || 0;
    const newSupplyPrice = parseInt(String(onewmsInfo.supply_price || '0'), 10) || 0;
    const newOriginalPrice = parseInt(String(onewmsInfo.org_price || '0'), 10) || 0;

    // Only update if changed
    if (
      newSellPrice !== dbProduct.sellPrice ||
      newSupplyPrice !== dbProduct.supplyPrice ||
      newOriginalPrice !== (dbProduct.originalPrice ?? 0)
    ) {
      try {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: {
            sellPrice: newSellPrice,
            supplyPrice: newSupplyPrice,
            originalPrice: newOriginalPrice,
          },
        });
        result.updated++;
      } catch {
        result.errors++;
      }
    }
  }

  console.log(
    `Price sync done: ${result.updated}/${result.total} updated, ${result.errors} errors`
  );

  return result;
}
