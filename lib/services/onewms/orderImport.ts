/**
 * ONEWMS Order Import Service
 * Imports orders from ONEWMS API into platform DB
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import type { OrderInfo } from '@/lib/onewms/types';

interface ImportOrdersResult {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ orderId: string; error: string }>;
}

/**
 * Map ONEWMS status string to platform OrderStatus
 */
function mapOrderStatus(status: string): 'PENDING' | 'APPROVED' {
  return status === '8' ? 'APPROVED' : 'PENDING';
}

/**
 * Map ONEWMS status string to platform ShippingStatus
 */
function mapShippingStatus(status: string): 'PENDING' | 'PREPARING' | 'SHIPPED' {
  const s = parseInt(status || '0', 10);
  if (s === 8) return 'SHIPPED';
  if (s >= 2) return 'PREPARING';
  return 'PENDING';
}

/**
 * Map ONEWMS status string to platform PaymentStatus
 */
function mapPaymentStatus(status: string): 'UNPAID' | 'PAID' {
  return status === '8' ? 'PAID' : 'UNPAID';
}

/**
 * Import orders from ONEWMS into the platform database.
 *
 * @param params.start_date - Start date (YYYY-MM-DD)
 * @param params.end_date - End date (YYYY-MM-DD)
 * @param params.sub_domain_seq - Optional warehouse filter
 */
export async function importOrdersFromOnewms(params: {
  start_date: string;
  end_date: string;
  sub_domain_seq?: string;
}): Promise<ImportOrdersResult> {
  const result: ImportOrdersResult = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  const client = createOnewmsClient();

  // Step 1: Fetch orders from ONEWMS
  const orders = await client.getOrderInfo({
    date_type: 'order_date',
    start_date: params.start_date,
    end_date: params.end_date,
    sub_domain_seq: params.sub_domain_seq,
    limit: 1000,
  });

  result.total = orders.length;
  console.log(`Fetched ${result.total} orders from ONEWMS`);

  if (orders.length === 0) return result;

  // Step 2: Get MASTER user (used as sellerId for imported orders)
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
        where: {
          orderNo: {
            startsWith: 'WMS-',
          },
        },
        select: { orderNo: true },
      })
    ).map((o) => o.orderNo)
  );

  // Step 4: Build product lookup map (onewmsCode -> Product)
  const productMap = new Map(
    (
      await prisma.product.findMany({
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
      })
    ).map((p) => [p.onewmsCode!, p])
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

    // Skip if already imported
    if (existingOrderNos.has(orderNo)) {
      result.skipped++;
      continue;
    }

    try {
      const status = String(order.status || '1');
      const totalAmount = parseInt(String(order.amount || '0'), 10) || 0;
      const orderProducts = order.order_products || [];

      // Build order items from order_products
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

      let hasUnmatchedProducts = false;

      for (const op of orderProducts) {
        const wmsProdId = op.product_id;
        const product = productMap.get(wmsProdId);

        if (!product) {
          // Product not found in DB - skip this order item but continue
          hasUnmatchedProducts = true;
          continue;
        }

        const qty = parseInt(String(op.qty || '1'), 10) || 1;
        const supplyPrice = product.supplyPrice;
        const totalSupply = supplyPrice * qty;
        const sellPricePerItem = product.sellPrice || 0;
        const margin = sellPricePerItem > 0 ? sellPricePerItem - supplyPrice : 0;

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

      // Skip order if no valid items
      if (orderItems.length === 0) {
        result.errors++;
        result.errorDetails.push({
          orderId: onewmsOrderId,
          error: 'No matching products found for order items',
        });
        continue;
      }

      // Create order with items and mapping in a transaction
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

        // Create ONEWMS order mapping
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
      existingOrderNos.add(orderNo); // Prevent duplicates within same batch

      if (hasUnmatchedProducts) {
        console.warn(
          `Order ${orderNo}: Some products not matched, imported with available items only`
        );
      }
    } catch (error) {
      result.errors++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errorDetails.push({ orderId: onewmsOrderId, error: message });
      console.error(`Failed to import order ${onewmsOrderId}:`, message);
    }
  }

  console.log(
    `Order import completed: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors`
  );

  return result;
}
