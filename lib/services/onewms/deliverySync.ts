/**
 * ONEWMS Delivery Status Synchronization Service
 * Polls ONEWMS for delivery status updates and triggers notifications
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import type { OrderStatus as OnewmsOrderStatus } from '@/lib/onewms/types';
import { sendNotification } from './notifications';

interface SyncResult {
  totalOrders: number;
  updated: number;
  errors: number;
  errorDetails: Array<{ orderId: string; error: string }>;
}

/**
 * Map ONEWMS order status to platform shipping status
 */
function mapOnewmsStatusToShippingStatus(
  onewmsStatus: number
): 'PENDING' | 'PREPARING' | 'SHIPPED' | 'PARTIAL' {
  // ONEWMS status codes:
  // 1: 접수 (Received)
  // 2-7: 승인/준비 상태 (Approved/Preparing)
  // 8: 출고완료 (Shipped)

  if (onewmsStatus === 8) {
    return 'SHIPPED';
  }

  if (onewmsStatus >= 2 && onewmsStatus <= 7) {
    return 'PREPARING';
  }

  return 'PENDING';
}

/**
 * Sync delivery status for a single order
 */
async function syncOrderDeliveryStatus(orderId: string): Promise<{
  success: boolean;
  updated: boolean;
  error?: string;
}> {
  try {
    // Get order mapping
    const mapping = await prisma.onewmsOrderMapping.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            shippingStatus: true,
            recipient: true,
            phone: true,
          },
        },
      },
    });

    if (!mapping) {
      return {
        success: false,
        updated: false,
        error: 'Order not synced to ONEWMS',
      };
    }

    if (mapping.status !== 'sent' && mapping.status !== 'shipped') {
      return {
        success: true,
        updated: false,
        error: 'Order not yet sent to ONEWMS',
      };
    }

    // Fetch order status from ONEWMS
    const client = createOnewmsClient();
    const orderInfo = await client.getOrderInfo(mapping.onewmsOrderNo);

    const onewmsStatus = typeof orderInfo.status === 'number' ? orderInfo.status : 0;
    const transNo = orderInfo.trans_no || null;
    const csStatus = orderInfo.cs_status || 0;
    const holdStatus = orderInfo.hold_status || 0;

    // Determine new shipping status
    const newShippingStatus = mapOnewmsStatusToShippingStatus(onewmsStatus);
    const oldShippingStatus = mapping.order.shippingStatus;

    let statusChanged = false;

    // Update if status changed
    if (newShippingStatus !== oldShippingStatus) {
      await prisma.$transaction(async (tx) => {
        // Update order shipping status
        await tx.order.update({
          where: { id: orderId },
          data: {
            shippingStatus: newShippingStatus,
          },
        });

        // Update mapping
        await tx.onewmsOrderMapping.update({
          where: { id: mapping.id },
          data: {
            status: newShippingStatus === 'SHIPPED' ? 'shipped' : 'sent',
            transNo,
            csStatus,
            holdStatus,
            lastSyncAt: new Date(),
          },
        });

        // Log status change
        await tx.onewmsDeliveryLog.create({
          data: {
            orderId,
            oldStatus: oldShippingStatus,
            newStatus: newShippingStatus,
            transNo,
            changedAt: new Date(),
            syncedFrom: 'onewms',
          },
        });
      });

      statusChanged = true;

      console.log(
        `Order ${mapping.order.orderNo} status updated: ${oldShippingStatus} → ${newShippingStatus}`
      );

      // Send notification if status changed to SHIPPED
      if (newShippingStatus === 'SHIPPED' && transNo) {
        await sendNotification({
          type: 'order_shipped',
          recipient: {
            name: mapping.order.recipient || 'Customer',
            phone: mapping.order.phone || '',
          },
          orderNo: mapping.order.orderNo,
          transNo,
        });
      }
    } else if (transNo && transNo !== mapping.transNo) {
      // Update tracking number if changed
      await prisma.onewmsOrderMapping.update({
        where: { id: mapping.id },
        data: {
          transNo,
          csStatus,
          holdStatus,
          lastSyncAt: new Date(),
        },
      });

      console.log(
        `Order ${mapping.order.orderNo} tracking number updated: ${transNo}`
      );
    }

    return { success: true, updated: statusChanged };
  } catch (error: any) {
    console.error(`Delivery sync failed for order ${orderId}:`, error);
    return {
      success: false,
      updated: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Sync delivery statuses for all active ONEWMS orders
 */
export async function syncDeliveryStatuses(): Promise<SyncResult> {
  const result: SyncResult = {
    totalOrders: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // Find all orders that are sent but not yet shipped
    const activeMappings = await prisma.onewmsOrderMapping.findMany({
      where: {
        status: {
          in: ['sent', 'shipped'],
        },
      },
      select: {
        orderId: true,
      },
      take: 100, // Process up to 100 orders per sync
    });

    result.totalOrders = activeMappings.length;
    console.log(`Starting delivery sync for ${result.totalOrders} orders`);

    // Sync orders in parallel (batches of 10 to avoid rate limits)
    const batchSize = 10;
    for (let i = 0; i < activeMappings.length; i += batchSize) {
      const batch = activeMappings.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map((mapping) => syncOrderDeliveryStatus(mapping.orderId))
      );

      // Aggregate results
      results.forEach((res, index) => {
        if (res.success) {
          if (res.updated) {
            result.updated++;
          }
        } else {
          result.errors++;
          result.errorDetails.push({
            orderId: batch[index].orderId,
            error: res.error || 'Unknown error',
          });
        }
      });

      // Small delay between batches
      if (i + batchSize < activeMappings.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `Delivery sync completed: ${result.updated} orders updated, ${result.errors} errors`
    );

    return result;
  } catch (error: any) {
    console.error('Delivery sync failed:', error);
    throw error;
  }
}

/**
 * Get delivery logs for an order
 */
export async function getDeliveryLogs(orderId: string) {
  return prisma.onewmsDeliveryLog.findMany({
    where: { orderId },
    orderBy: { changedAt: 'desc' },
  });
}
