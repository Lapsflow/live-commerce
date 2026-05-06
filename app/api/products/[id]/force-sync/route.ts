/**
 * POST /api/products/:id/force-sync
 * 본사(HEADQUARTERS) 상품을 ONEWMS에서 강제 동기화 (재고 + 가격)
 * MASTER/SUB_MASTER 전용
 */

import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getRealtimeStock } from '@/lib/services/onewms/realtime';
import { getOnewmsProductMap } from '@/lib/services/onewms/autoRegister';
import { logAudit } from '@/lib/services/audit';

export const POST = withRole(
  ['MASTER', 'SUB_MASTER'],
  async (req: NextRequest, user: AuthUser, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        barcode: true,
        onewmsCode: true,
        productType: true,
        sellPrice: true,
        supplyPrice: true,
        originalPrice: true,
        totalStock: true,
      },
    });

    if (!product) {
      return errors.notFound('상품');
    }

    if (product.productType !== 'HEADQUARTERS') {
      return errors.badRequest('본사(WMS) 상품만 강제 동기화할 수 있습니다');
    }

    if (!product.onewmsCode) {
      return errors.badRequest('ONEWMS 코드가 없는 상품입니다');
    }

    const before = {
      totalStock: product.totalStock,
      sellPrice: product.sellPrice,
      supplyPrice: product.supplyPrice,
      originalPrice: product.originalPrice,
    };

    const updateData: Record<string, unknown> = {};
    const syncDetails: string[] = [];

    // 1. 실시간 재고 동기화
    try {
      const realtimeStock = await getRealtimeStock(product.onewmsCode, { skipCache: true });
      if (realtimeStock !== null) {
        updateData.totalStock = realtimeStock;
        if (realtimeStock !== product.totalStock) {
          syncDetails.push(`재고: ${product.totalStock} → ${realtimeStock}`);
        }
      }
    } catch (err) {
      console.error('[FORCE-SYNC] Stock fetch failed:', err);
    }

    // 2. 가격 동기화 (ONEWMS 상품 목록에서 조회)
    try {
      const productMap = await getOnewmsProductMap();
      const onewmsProduct = productMap.get(product.onewmsCode);

      if (onewmsProduct) {
        const shopPrice = parseInt(String(onewmsProduct.shop_price)) || 0;
        const supplyPrice = parseInt(String(onewmsProduct.supply_price)) || 0;
        const orgPrice = parseInt(String(onewmsProduct.org_price)) || 0;

        if (shopPrice > 0 && shopPrice !== product.sellPrice) {
          updateData.sellPrice = shopPrice;
          syncDetails.push(`판매가: ${product.sellPrice} → ${shopPrice}`);
        }
        if (supplyPrice > 0 && supplyPrice !== product.supplyPrice) {
          updateData.supplyPrice = supplyPrice;
          syncDetails.push(`공급가: ${product.supplyPrice} → ${supplyPrice}`);
        }
        if (orgPrice > 0 && orgPrice !== product.originalPrice) {
          updateData.originalPrice = orgPrice;
          syncDetails.push(`원가: ${product.originalPrice ?? 0} → ${orgPrice}`);
        }
      }
    } catch (err) {
      console.error('[FORCE-SYNC] Price fetch failed:', err);
    }

    // 3. DB 업데이트
    if (Object.keys(updateData).length === 0) {
      return ok({
        message: '이미 최신 상태입니다',
        synced: false,
        product,
      });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: id,
      entityName: product.name,
      before,
      after: updateData,
      description: `ONEWMS 강제 동기화: ${product.name} (${syncDetails.join(', ')})`,
      request: req,
    });

    return ok({
      message: `동기화 완료: ${syncDetails.join(', ')}`,
      synced: true,
      changes: syncDetails,
      product: updated,
    });
  }
);
