import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, errors } from '@/lib/api/response';
import { normBarcode } from '@/lib/utils/barcode';
import { getActiveCenterIdForSeller } from '@/lib/services/broadcasts';
import { getRealtimeStock } from '@/lib/services/onewms/realtime';

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
export const GET = withRole(["MASTER", "SUB_MASTER", "SELLER"], async (req: NextRequest, user: AuthUser) => {
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

  // B-6: 센터 상품 접근 권한 체크 (셀러만)
  if (user.role === "SELLER" && product.productType === "CENTER" && product.managedBy) {
    const activeCenterId = await getActiveCenterIdForSeller(user.userId);
    if (!activeCenterId) {
      return errors.forbidden("활성 방송이 없어 센터 상품에 접근할 수 없습니다");
    }
    if (activeCenterId !== product.managedBy) {
      return errors.forbidden("현재 방송 센터와 다른 센터의 상품에는 접근할 수 없습니다");
    }
  }

  // 재고 계산: HQ 상품은 ONEWMS 실시간 → product.totalStock 순 폴백
  // CENTER 상품은 product.totalStock 사용 (warehouseInventories는 창고별 상세로만 사용)
  let totalStock = product.totalStock;

  if (product.productType === "HEADQUARTERS" && product.onewmsCode) {
    try {
      const realtimeStock = await getRealtimeStock(product.onewmsCode);
      if (realtimeStock !== null) {
        totalStock = realtimeStock;
        // Background DB cache update
        if (realtimeStock !== product.totalStock) {
          prisma.product
            .update({ where: { id: product.id }, data: { totalStock: realtimeStock } })
            .catch(() => {});
        }
      }
    } catch {
      // ONEWMS 장애 시 DB totalStock 그대로 사용
    }
  }

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
