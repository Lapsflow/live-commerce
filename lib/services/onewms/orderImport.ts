/**
 * ONEWMS Order Import Service
 * Imports orders from ONEWMS API into platform DB.
 * Auto-creates products when order references unknown product_ids.
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import type { OrderInfo } from '@/lib/onewms/types';

interface ImportOrdersResult {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  productsAutoCreated: number;
  errorDetails: Array<{ orderId: string; error: string }>;
  page: number;
  hasMore: boolean;
}

function mapOrderStatus(status: string): 'PENDING' | 'APPROVED' {
  return status === '8' ? 'APPROVED' : 'PENDING';
}

function mapShippingStatus(status: string): 'PENDING' | 'PREPARING' | 'SHIPPED' {
  const s = parseInt(status || '0', 10);
  if (s === 8) return 'SHIPPED';
  if (s >= 2) return 'PREPARING';
  return 'PENDING';
}

function mapPaymentStatus(status: string): 'UNPAID' | 'PAID' {
  return status === '8' ? 'PAID' : 'UNPAID';
}

/**
 * Auto-create a product in DB from ONEWMS order product data.
 * Uses stock API to get barcode, or falls back to synthetic barcode.
 */
async function autoCreateProduct(
  onewmsProductId: string,
  productName: string,
  client: ReturnType<typeof createOnewmsClient>,
  existingBarcodes: Set<string>
) {
  const code = `WMS-${onewmsProductId}`;

  // Try to get barcode from stock API
  let barcode = `WMS-OP-${onewmsProductId}`;
  try {
    const stockData = await client.getStockInfo('product_id', onewmsProductId);
    const entry = stockData[onewmsProductId];
    if (entry?.barcode) {
      barcode = entry.barcode;
      // Handle barcode collision
      if (existingBarcodes.has(barcode)) {
        barcode = `${barcode}-${onewmsProductId}`;
      }
    }
  } catch {
    // Stock API failed, use synthetic barcode
  }

  // Ensure barcode uniqueness
  if (existingBarcodes.has(barcode)) {
    barcode = `WMS-OP-${onewmsProductId}`;
  }

  const product = await prisma.product.create({
    data: {
      code,
      name: productName || `WMS Order Product ${onewmsProductId}`,
      barcode,
      sellPrice: 0,
      supplyPrice: 0,
      onewmsCode: onewmsProductId,
      onewmsBarcode: barcode.startsWith('WMS-OP-') ? null : barcode,
      productType: 'HEADQUARTERS',
      isWmsProduct: true,
    },
  });

  existingBarcodes.add(barcode);
  return product;
}

/**
 * Import orders from ONEWMS into the platform database.
 * Batch mode: processes one page at a time (default 50 orders per page).
 * Auto-creates products when order_products reference unknown product_ids.
 */
export async function importOrdersFromOnewms(params: {
  start_date: string;
  end_date: string;
  sub_domain_seq?: string;
  page?: number;
  limit?: number;
}): Promise<ImportOrdersResult> {
  const page = params.page || 1;
  const limit = params.limit || 50;

  const result: ImportOrdersResult = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    productsAutoCreated: 0,
    errorDetails: [],
    page,
    hasMore: false,
  };

  const client = createOnewmsClient();

  // Step 1: Fetch orders from ONEWMS (batch mode with page/limit)
  // 운영 검증(v6/v7): sub_domain_seq 미지정 시 client.getOrderInfo 가 config.subDomainSeq("62", 한국무진유통)
  // 자동 적용한다. 과거 hardcode 였던 "20" (테테 화주) 는 한국무진 데이터와 무관 — 제거.
  const orders = await client.getOrderInfo({
    date_type: 'order_date',
    start_date: params.start_date,
    end_date: params.end_date,
    ...(params.sub_domain_seq && { sub_domain_seq: params.sub_domain_seq }),
    page,
    limit,
  });

  // If we got exactly `limit` orders, there are likely more pages
  result.hasMore = orders.length >= limit;

  result.total = orders.length;
  console.log(`Fetched ${result.total} orders from ONEWMS`);

  if (orders.length === 0) return result;

  // Step 2: Get MASTER user
  const masterUser = await prisma.user.findFirst({
    where: { role: 'MASTER' },
    select: { id: true },
  });

  if (!masterUser) {
    throw new Error('MASTER user not found. Cannot import orders without a seller.');
  }

  // Step 3: Get existing order numbers to skip duplicates
  const existingOrderNos = new Set(
    (
      await prisma.order.findMany({
        where: { orderNo: { startsWith: 'WMS-' } },
        select: { orderNo: true },
      })
    ).map((o) => o.orderNo)
  );

  // Step 4: Build product lookup map (onewmsCode -> Product)
  const allProducts = await prisma.product.findMany({
    where: { onewmsCode: { not: null } },
    select: {
      id: true,
      code: true,
      name: true,
      barcode: true,
      supplyPrice: true,
      sellPrice: true,
      onewmsCode: true,
    },
  });

  const productMap = new Map(allProducts.map((p) => [p.onewmsCode!, p]));
  const existingBarcodes = new Set(
    (await prisma.product.findMany({ select: { barcode: true } })).map((p) => p.barcode)
  );
  const existingCodes = new Set(
    (await prisma.product.findMany({ select: { code: true } })).map((p) => p.code)
  );

  // Step 5: Import each order
  for (const order of orders) {
    const onewmsOrderId = order.order_id || order.seq;
    if (!onewmsOrderId) {
      result.errors++;
      result.errorDetails.push({ orderId: 'unknown', error: 'Missing order_id' });
      continue;
    }

    const orderNo = `WMS-${onewmsOrderId}`;

    if (existingOrderNos.has(orderNo)) {
      result.skipped++;
      continue;
    }

    try {
      const status = String(order.status || '1');
      const totalAmount = parseInt(String(order.amount || '0'), 10) || 0;
      const orderProducts = order.order_products || [];

      // Build order items, auto-creating missing products
      const orderItems: Array<{
        productId: string;
        quantity: number;
        barcode: string;
        productName: string;
        supplyPrice: number;
        totalSupply: number;
        margin: number;
        productType: 'HEADQUARTERS' | 'CENTER';
      }> = [];

      for (const op of orderProducts) {
        const wmsProdId = op.product_id;
        if (!wmsProdId) continue;

        let product = productMap.get(wmsProdId);

        // Auto-create product if not found
        if (!product) {
          const code = `WMS-${wmsProdId}`;
          if (existingCodes.has(code)) {
            // Code collision - product exists with different onewmsCode lookup
            const existing = await prisma.product.findUnique({
              where: { code },
              select: { id: true, code: true, name: true, barcode: true, supplyPrice: true, sellPrice: true, onewmsCode: true },
            });
            if (existing) {
              product = existing;
              productMap.set(wmsProdId, existing);
            }
          }

          if (!product) {
            try {
              const created = await autoCreateProduct(
                wmsProdId,
                order.product_name || '',
                client,
                existingBarcodes
              );
              product = {
                id: created.id,
                code: created.code,
                name: created.name,
                barcode: created.barcode,
                supplyPrice: created.supplyPrice,
                sellPrice: created.sellPrice,
                onewmsCode: created.onewmsCode,
              };
              productMap.set(wmsProdId, product);
              existingCodes.add(created.code);
              result.productsAutoCreated++;
            } catch (err) {
              // Product auto-creation failed, skip this item
              console.error(`Failed to auto-create product ${wmsProdId}:`, err);
              continue;
            }
          }
        }

        const qty = parseInt(String(op.qty || '1'), 10) || 1;
        const supplyPrice = parseInt(String(op.prd_supply_price || '0'), 10) || product.supplyPrice;
        const totalSupply = supplyPrice * qty;
        const sellPrice = product.sellPrice || 0;
        const margin = sellPrice > 0 ? sellPrice - supplyPrice : 0;

        orderItems.push({
          productId: product.id,
          quantity: qty,
          barcode: product.barcode,
          productName: product.name,
          supplyPrice,
          totalSupply,
          margin,
          productType: 'HEADQUARTERS',
        });
      }

      if (orderItems.length === 0) {
        result.errors++;
        result.errorDetails.push({
          orderId: onewmsOrderId,
          error: 'No valid products for order items',
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            orderNo,
            sellerId: masterUser.id,
            status: mapOrderStatus(status),
            totalAmount,
            recipient: order.recv_name || null,
            phone: order.recv_mobile || order.order_mobile || null,
            address: order.recv_address || null,
            memo: order.memo || null,
            shippingStatus: mapShippingStatus(status),
            paymentStatus: mapPaymentStatus(status),
            productType: 'HEADQUARTERS',
            items: {
              create: orderItems,
            },
          },
        });

        const csStatus = parseInt(String(order.order_cs || '0'), 10) || 0;
        const holdStatus = parseInt(String(order.hold || '0'), 10) || 0;
        const transNo = order.trans_no || null;

        await tx.onewmsOrderMapping.create({
          data: {
            orderId: newOrder.id,
            onewmsOrderNo: onewmsOrderId,
            status: status === '8' ? 'shipped' : 'sent',
            transNo,
            csStatus,
            holdStatus,
            sentAt: new Date(),
            lastSyncAt: new Date(),
          },
        });
      });

      result.created++;
      existingOrderNos.add(orderNo);
    } catch (error) {
      result.errors++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errorDetails.push({ orderId: onewmsOrderId, error: message });
      console.error(`Failed to import order ${onewmsOrderId}:`, message);
    }
  }

  console.log(
    `Order import completed: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors, ${result.productsAutoCreated} products auto-created`
  );

  return result;
}
