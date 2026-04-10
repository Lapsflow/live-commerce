import { GoogleSheetsClient } from '@/lib/google-sheets/client';
import { db } from '@/lib/db';
import { normBarcode } from '@/lib/utils/barcode';

interface SyncResult {
  warehouseId: string;
  warehouseName: string;
  success: boolean;
  recordsProcessed: number;
  error?: string;
}

/**
 * Get or create product by barcode
 * Creates a placeholder product if barcode doesn't exist
 */
async function getOrCreateProduct(
  barcode: string,
  productName?: string
): Promise<string> {
  const normalized = normBarcode(barcode);

  // Try to find existing product by barcode
  let product = await db.product.findFirst({
    where: {
      OR: [{ barcode: normalized }, { onewmsBarcode: normalized }],
    },
  });

  // If product doesn't exist, create placeholder
  if (!product) {
    product = await db.product.create({
      data: {
        code: `AUTO-${Date.now()}`, // Auto-generated code
        name: productName || `상품-${normalized}`,
        barcode: normalized,
        sellPrice: 0,
        supplyPrice: 0,
        totalStock: 0,
      },
    });
  }

  return product.id;
}

/**
 * Sync inventory for a single warehouse
 */
export async function syncWarehouseInventory(
  warehouseId: string
): Promise<SyncResult> {
  try {
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new Error(`Warehouse not found: ${warehouseId}`);
    }

    if (!warehouse.spreadsheetId) {
      throw new Error(`Warehouse ${warehouse.name} has no spreadsheet configured`);
    }

    // Create Google Sheets client
    const sheetsClient = new GoogleSheetsClient();

    // Fetch inventory data from spreadsheet
    const inventoryData = await sheetsClient.parseInventoryData({
      spreadsheetId: warehouse.spreadsheetId,
      sheetName: warehouse.sheetName || 'Sheet1',
    });

    let recordsProcessed = 0;

    // Upsert inventory records
    for (const row of inventoryData) {
      try {
        const productId = await getOrCreateProduct(row.barcode, row.productName);

        await db.warehouseInventory.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: warehouse.id,
              productId,
            },
          },
          create: {
            warehouseId: warehouse.id,
            productId,
            barcode: normBarcode(row.barcode),
            quantity: row.quantity,
            location: row.location,
            syncedFrom: 'SPREADSHEET',
            lastUpdated: new Date(),
          },
          update: {
            quantity: row.quantity,
            location: row.location,
            lastUpdated: new Date(),
            syncedFrom: 'SPREADSHEET',
          },
        });

        recordsProcessed++;
      } catch (error) {
        console.error(`Error processing row for barcode ${row.barcode}:`, error);
        // Continue processing other rows
      }
    }

    // Update warehouse last sync time
    await db.warehouse.update({
      where: { id: warehouseId },
      data: { lastSyncAt: new Date() },
    });

    return {
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      success: true,
      recordsProcessed,
    };
  } catch (error) {
    return {
      warehouseId,
      warehouseName: 'Unknown',
      success: false,
      recordsProcessed: 0,
      error: error.message,
    };
  }
}

/**
 * Sync all enabled warehouses
 */
export async function syncAllWarehouses(): Promise<SyncResult[]> {
  const warehouses = await db.warehouse.findMany({
    where: { syncEnabled: true },
  });

  const results: SyncResult[] = [];

  for (const warehouse of warehouses) {
    const result = await syncWarehouseInventory(warehouse.id);
    results.push(result);

    if (result.success) {
      console.log(`✅ Synced: ${result.warehouseName} (${result.recordsProcessed} records)`);
    } else {
      console.error(`❌ Failed: ${result.warehouseName} - ${result.error}`);
    }
  }

  return results;
}

/**
 * Calculate total stock across all warehouses for a product
 */
export async function calculateTotalStock(productId: string): Promise<number> {
  const inventories = await db.warehouseInventory.findMany({
    where: { productId },
  });

  return inventories.reduce((sum, inv) => sum + inv.quantity, 0);
}

/**
 * Update product totalStock field based on warehouse inventories
 */
export async function updateProductTotalStock(productId: string): Promise<void> {
  const totalStock = await calculateTotalStock(productId);

  await db.product.update({
    where: { id: productId },
    data: { totalStock },
  });
}
