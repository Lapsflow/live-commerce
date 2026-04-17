import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, errors } from '@/lib/api/response';
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
  totalStock: number;
  warehouses: WarehouseStock[];
}

/**
 * Barcode Search API
 *
 * GET /api/barcode/search?barcode=8801234567890
 *
 * Returns product information with inventory across all warehouses
 */
export const GET = withRole(["MASTER", "ADMIN", "SELLER"], async (req: NextRequest, _user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode');

  if (!barcode) {
    return errors.badRequest('Barcode parameter is required');
  }

  const normalized = normBarcode(barcode);

  const product = await prisma.product.findFirst({
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
    return errors.notFound('상품');
  }

  const totalStock = product.warehouseInventories.reduce(
    (sum, inv) => sum + inv.quantity,
    0
  );

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

  return ok(result);
});
