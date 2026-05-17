/**
 * ONEWMS Order Synchronization Service
 * Handles order sync to ONEWMS warehouse with retry logic and transaction management
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import { getOnewmsConfig } from '@/lib/onewms/config';
import type { CreateOrderRequest, CreateOrderRow } from '@/lib/onewms/types';

interface SyncResult {
  success: boolean;
  onewmsOrderNo?: string;
  error?: string;
}

interface RetryResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ orderId: string; error: string }>;
}

/**
 * Synchronize a single order to ONEWMS
 * Creates OnewmsOrderMapping record and sends order data to ONEWMS API
 */
export async function syncOrderToOnewms(orderId: string): Promise<SyncResult> {
  try {
    // Fetch order with items and product details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        seller: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Check if order is approved
    if (order.status !== 'APPROVED') {
      return { success: false, error: 'Order must be approved before syncing' };
    }

    // Check if already synced
    const existing = await prisma.onewmsOrderMapping.findUnique({
      where: { orderId },
    });

    if (existing && existing.status === 'sent') {
      return { success: false, error: 'Order already synced to ONEWMS' };
    }

    // Validate required fields (with null guard)
    if (!order.recipient?.trim()) {
      return {
        success: false,
        error: 'Order missing required recipient name',
      };
    }
    // Phone and address can be empty but should have safe defaults
    const recipientPhone = order.phone?.trim() || '';
    const recipientAddress = order.address?.trim() || '';

    // Validate all products have ONEWMS codes
    const missingCodes = order.items.filter((item) => !item.product.onewmsCode);
    if (missingCodes.length > 0) {
      const productNames = missingCodes
        .map((item) => item.product.name)
        .join(', ');
      return {
        success: false,
        error: `Products missing ONEWMS codes: ${productNames}`,
      };
    }

    // Generate ONEWMS order number (format: LIVE-YYYYMMDD-XXXXX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const onewmsOrderNo = `LIVE-${dateStr}-${randomSuffix}`;

    // Get shop_id from config (P0 hotfix requirement)
    let shopId: string;
    try {
      const config = getOnewmsConfig();
      if (!config.shopId) {
        return {
          success: false,
          error: 'ONEWMS_SHOP_ID not configured. Run: pnpm tsx scripts/onewms-bootstrap-shop.ts',
        };
      }
      shopId = config.shopId;
    } catch (err) {
      return {
        success: false,
        error: 'Failed to load ONEWMS configuration',
      };
    }

    // Prepare ONEWMS order request (P0 hotfix: new schema with rows array)
    // Each OrderItem becomes one row in the set_orders JSON array
    const orderRows: CreateOrderRow[] = order.items.map((item) => ({
      order_id: onewmsOrderNo,                        // 주문번호 (필수)
      shop_product_id: item.product.onewmsCode!,      // 상품코드 (필수)
      qty: item.quantity,                             // 수량 (필수)
      recv_name: order.recipient.trim(),              // 수령자명 (필수, null guard)
      recv_mobile: recipientPhone,                     // 수령자 휴대폰 (선택)
      recv_address: recipientAddress,                 // 수령자 주소 (선택)
      product_name: item.product.name,                // 상품명 (선택)
      ...(order.memo && { memo: order.memo }),        // 배송메모 (선택, Schema 확인 후 포함)
    }));

    const onewmsRequest: CreateOrderRequest = {
      shop_id: shopId,                                // P0: 판매처코드 (필수)
      collect_date: order.createdAt.toISOString().slice(0, 10), // 발주일 (선택)
      rows: orderRows,                                 // P0: 주문 행 배열
    };

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create or update mapping record
      const mapping = await tx.onewmsOrderMapping.upsert({
        where: { orderId },
        create: {
          orderId,
          onewmsOrderNo,
          status: 'pending',
          retryCount: 0,
        },
        update: {
          onewmsOrderNo,
          status: 'pending',
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      // Send to ONEWMS
      try {
        const client = createOnewmsClient();
        await client.createOrder(onewmsRequest);

        // Update mapping to 'sent' status
        await tx.onewmsOrderMapping.update({
          where: { id: mapping.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            lastSyncAt: new Date(),
            errorMessage: null,
          },
        });

        // Update order shipping status
        await tx.order.update({
          where: { id: orderId },
          data: {
            shippingStatus: 'PREPARING',
          },
        });

        return { success: true, onewmsOrderNo };
      } catch (apiError: any) {
        // Update mapping with error
        await tx.onewmsOrderMapping.update({
          where: { id: mapping.id },
          data: {
            status: 'failed',
            errorMessage: apiError.message || 'Unknown ONEWMS API error',
            lastSyncAt: new Date(),
            retryCount: mapping.retryCount + 1,
          },
        });

        throw apiError;
      }
    });

    return result;
  } catch (error) {
    console.error(`Order sync failed for ${orderId}:`, error);
    const message = error instanceof Error ? error.message : 'Failed to sync order to ONEWMS';

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Retry failed orders with exponential backoff
 * Processes orders with status 'failed' and retryCount < 3
 */
export async function retryFailedOrders(): Promise<RetryResult> {
  const result: RetryResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Find failed orders eligible for retry (retryCount < 3)
    const failedMappings = await prisma.onewmsOrderMapping.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 },
      },
      include: {
        order: true,
      },
      take: 10, // Process in batches of 10
    });

    console.log(`Found ${failedMappings.length} failed orders to retry`);

    for (const mapping of failedMappings) {
      result.processed++;

      // Calculate exponential backoff delay
      const backoffMinutes = Math.pow(2, mapping.retryCount) * 5; // 5, 10, 20 minutes
      const nextRetryTime = new Date(
        mapping.lastSyncAt!.getTime() + backoffMinutes * 60 * 1000
      );

      // Check if enough time has passed for retry
      if (new Date() < nextRetryTime) {
        console.log(
          `Skipping order ${mapping.orderId} - retry scheduled for ${nextRetryTime.toISOString()}`
        );
        continue;
      }

      // Attempt to sync order
      const syncResult = await syncOrderToOnewms(mapping.orderId);

      if (syncResult.success) {
        result.succeeded++;
        console.log(
          `Successfully synced order ${mapping.orderId} on retry ${mapping.retryCount + 1}`
        );
      } else {
        result.failed++;
        result.errors.push({
          orderId: mapping.orderId,
          error: syncResult.error || 'Unknown error',
        });

        // Check if max retries reached
        const updatedMapping = await prisma.onewmsOrderMapping.findUnique({
          where: { id: mapping.id },
        });

        if (updatedMapping && updatedMapping.retryCount >= 3) {
          // Mark as needing manual intervention
          await prisma.onewmsOrderMapping.update({
            where: { id: mapping.id },
            data: {
              status: 'manual_intervention',
            },
          });

          console.log(
            `Order ${mapping.orderId} moved to manual_intervention after ${updatedMapping.retryCount} retries`
          );
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error('Failed to retry orders:', error);
    throw error;
  }
}

/**
 * Get order sync status
 */
export async function getOrderSyncStatus(orderId: string) {
  const mapping = await prisma.onewmsOrderMapping.findUnique({
    where: { orderId },
    include: {
      order: {
        select: {
          orderNo: true,
          status: true,
          shippingStatus: true,
          createdAt: true,
        },
      },
    },
  });

  if (!mapping) {
    return {
      synced: false,
      status: 'not_synced',
      message: 'Order has not been synced to ONEWMS',
    };
  }

  return {
    synced: mapping.status === 'sent' || mapping.status === 'shipped',
    status: mapping.status,
    onewmsOrderNo: mapping.onewmsOrderNo,
    sentAt: mapping.sentAt,
    lastSyncAt: mapping.lastSyncAt,
    transNo: mapping.transNo,
    errorMessage: mapping.errorMessage,
    retryCount: mapping.retryCount,
    order: mapping.order,
  };
}
