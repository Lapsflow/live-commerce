/**
 * ONEWMS Order Synchronization Service
 * Handles order sync to ONEWMS warehouse with retry logic and transaction management
 */

import { prisma } from '@/lib/db/prisma';
import { createOnewmsClient } from '@/lib/onewms';
import { getOnewmsConfig } from '@/lib/onewms/config';
import type { CreateOrderRequest, CreateOrderRow } from '@/lib/onewms/types';
import { sanitizeMemo } from '@/lib/utils/memo';

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
    if (!order.recipient || !order.recipient.trim()) {
      return {
        success: false,
        error: 'Order missing required recipient name',
      };
    }
    // Type narrowing: after guard check, assign to ensure TypeScript recognizes non-null
    const recipientName = order.recipient.trim();
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

    // Prepare ONEWMS order request (공식 02-set_orders.md 정합)
    // 각 OrderItem 이 set_orders JSON 배열의 row 1개
    // PDF §4.2 요구: "판매처 식별자 = 셀러 username" → cust_id 필드에 매핑
    // 운영 검증(#4) 보강: 셀러 이름·전화번호·username 을 주문자 정보로 ONEWMS 측에 전달
    //   하여 WMS 운영자가 어떤 셀러의 주문인지 식별 가능하게 함.
    const sellerUsername = (order.seller as { username?: string })?.username || order.seller?.id || '';
    const sellerName = order.seller?.name || '';
    const sellerPhone = (order.seller as { phone?: string })?.phone?.replace(/-/g, '').trim() || '';
    const createdAtIso = order.createdAt.toISOString();
    const orderDate = createdAtIso.slice(0, 10);              // YYYY-MM-DD
    const orderTime = createdAtIso.slice(11, 19);             // HH:MM:SS

    // 2026-06-10: 동기화 시점 memo placeholder 방어선.
    //   bulk 업로드 필터(2026-06-08 배포) 이전에 업로드되어 DB 에 "비고 (선택)" 류
    //   placeholder 메모가 저장된 발주가 지금 컨펌 → 동기화될 때 ONEWMS 로
    //   placeholder 가 그대로 전송되는 갭 차단. 빈 값이면 memo 필드 미전송.
    const orderMemo = sanitizeMemo(order.memo);

    // 운영 검증(2026-05-26): ONEWMS 자동 매칭 표준 형식 적용
    // 운영진(한국무진) 답변:
    //   "정상 매칭 건의 판매처상품코드가 'code'로 저장되어 있고, 판매처옵션은
    //   '<상품명>...<옵션>...' 형태로 저장된 것을 확인"
    //   "동일한 형식으로 전송하도록 수정하면 자동 매칭이 가능"
    //
    // 변경:
    //   - shop_product_id: ONEWMS product_id → "code" 고정 문자열
    //   - options: 신규 추가 → "<상품명>cleanName<옵션>originalName" 형식
    //     cleanName 은 product.name 에서 [숫자] prefix 제거 (예: [901]밀크킥 → 밀크킥)
    //   - product_name: 그대로 유지 (운영 가시성)
    //   - varchar(255) 안전망: options 가 길어질 경우 truncate
    const orderRows: CreateOrderRow[] = order.items.map((item, idx) => {
      const productName = item.product.name;
      // [숫자] 또는 [Cxx-xxx] prefix 제거 후 깨끗한 상품명 추출
      const cleanProductName = productName.replace(/^\[[^\]]+\]\s*/, '').trim() || productName;
      // ONEWMS 자동 매칭 표준: <상품명>실제상품명<옵션>고유번호포함상품명
      const optionsRaw = `<상품명>${cleanProductName}<옵션>${productName}`;
      const options = optionsRaw.length > 255 ? optionsRaw.slice(0, 255) : optionsRaw;

      return {
        order_id: onewmsOrderNo,                              // 주문번호 (필수, varchar(40))
        order_id_seq: String(idx + 1),                        // 주문상세번호 (item 식별용)
        shop_product_id: 'code',                              // ONEWMS 자동 매칭 트리거 (운영진 검증 형식)
        qty: item.quantity,                                   // 주문수량 (필수)
        recv_name: recipientName,                             // 수령자명 (필수)
        recv_mobile: recipientPhone,                          // 수령자핸드폰
        recv_address: recipientAddress,                       // 수령자주소
        product_name: productName,                            // 판매처상품명 (운영 가시성 유지)
        options,                                              // 판매처옵션 (자동 매칭 핵심)
        order_date: orderDate,                                // 주문일자 (운영 추적용)
        order_time: orderTime,                                // 주문일시 (운영 추적용)
        ...(sellerName && { order_name: sellerName }),        // 주문자명 = 셀러 이름
        ...(sellerPhone && { order_mobile: sellerPhone }),    // 주문자핸드폰 = 셀러 전화
        ...(sellerUsername && { cust_id: sellerUsername }),   // PDF §4.2: 판매처 식별자 = 셀러 username
        ...(orderMemo && { memo: orderMemo }),                // 배송메모 (placeholder 필터 적용)
      };
    });

    // collect_date: 공식 문서 표기는 YY-MM-DD (2자리 연도) 이지만 PHP date 파싱은 4자리도 허용.
    // 보수적으로 공식 표기 그대로 따라 YY-MM-DD 로 전송 (운영 검증 #4 안전망).
    const collectDateYY = order.createdAt.toISOString().slice(2, 10); // 26-05-22

    const onewmsRequest: CreateOrderRequest = {
      shop_id: shopId,                                // 판매처코드 (필수)
      collect_date: collectDateYY,                    // 발주일 (YY-MM-DD)
      rows: orderRows,                                // JSON body 로 전송될 row 배열
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
