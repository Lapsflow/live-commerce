import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normBarcode } from '@/lib/utils/barcode';

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  location?: string;
  lastUpdated: string;
}

interface ProductWithInventory {
  id: string;
  name: string;
  code: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  totalStock: number; // Sum of all warehouses
  warehouses: WarehouseStock[];
}

/**
 * Barcode Search API
 *
 * GET /api/barcode/search?barcode=8801234567890
 *
 * Returns product information with inventory across all warehouses
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode');

  if (!barcode) {
    return NextResponse.json(
      { error: 'Barcode parameter is required' },
      { status: 400 }
    );
  }

  const normalized = normBarcode(barcode);

  try {
    // Find product with warehouse inventories
    const product = await db.product.findFirst({
      where: {
        OR: [
          { barcode: normalized },
          { onewmsBarcode: normalized },
        ],
      },
      include: {
        warehouseInventories: {
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: {
            warehouse: { code: 'asc' },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found', barcode: normalized },
        { status: 404 }
      );
    }

    // Calculate total stock across all warehouses
    const totalStock = product.warehouseInventories.reduce(
      (sum, inv) => sum + inv.quantity,
      0
    );

    // Format warehouse stocks
    const warehouses: WarehouseStock[] = product.warehouseInventories.map(
      (inv) => ({
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        warehouseCode: inv.warehouse.code,
        quantity: inv.quantity,
        location: inv.location || undefined,
        lastUpdated: inv.lastUpdated.toISOString(),
      })
    );

    const result: ProductWithInventory = {
      id: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      sellPrice: product.sellPrice,
      supplyPrice: product.supplyPrice,
      totalStock,
      warehouses,
    };

    return NextResponse.json({ product: result });
  } catch (error) {
    console.error('[Barcode Search] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}
