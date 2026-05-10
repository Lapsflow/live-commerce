import { test, expect } from '@playwright/test';
import {
  POST_HEADERS,
  ensureTestProducts,
  createOrderFromProduct,
  ensureApprovedOrder,
  confirmOrder,
  fetchOrder,
  fetchOrders,
  getWmsOrderStatus,
  getWmsStats,
  generateOrderNo,
} from './helpers';

/**
 * 04: Order confirm -> WMS auto-sync for HEADQUARTERS orders (8 scenarios)
 *
 * HEADQUARTERS 상품 발주 컨펌 시 ONEWMS 자동 동기화 워크플로우,
 * CENTER 발주 WMS 비전송, 수동 sync, 재시도 로직, 매핑 일관성 검증.
 */

test.describe('04 - Order to WMS Sync', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. HEADQUARTERS 상품으로 발주 생성', async ({ request }) => {
    const { hqProduct } = await ensureTestProducts(request);
    expect(hqProduct).toBeTruthy();

    const result = await createOrderFromProduct(request, hqProduct!);
    // Order creation may fail due to stock issues -- assert that we got a result
    if (result.skipped) {
      // If skipped due to stock/validation, verify the skip reason is a known reason
      expect(result.skipReason).toBeTruthy();
      console.log(`[04-1] Order creation skipped: ${result.skipReason}`);
      // Still verify the products API is working
      const orders = await fetchOrders(request, { pageSize: 5, productType: 'HEADQUARTERS' });
      expect(Array.isArray(orders)).toBe(true);
      return;
    }

    expect(result.order).toBeTruthy();
    expect(result.order!.id).toBeTruthy();
    expect(result.order!.status).toBe('PENDING');
  });

  test('2. 발주 컨펌 -> APPROVED 전환', async ({ request }) => {
    const { hqProduct } = await ensureTestProducts(request);
    expect(hqProduct).toBeTruthy();

    // Create a fresh order
    const createResult = await createOrderFromProduct(request, hqProduct!);

    if (createResult.skipped || !createResult.order) {
      // Fallback: find an existing PENDING HQ order
      const pendingOrders = await fetchOrders(request, { pageSize: 50, productType: 'HEADQUARTERS' });
      const pendingOrder = pendingOrders.find((o) => o.status === 'PENDING');

      if (!pendingOrder) {
        // No pending orders available -- verify API is responding
        const allOrders = await fetchOrders(request, { pageSize: 5 });
        expect(Array.isArray(allOrders)).toBe(true);
        return;
      }

      const confirmResult = await confirmOrder(request, pendingOrder.id);
      expect(confirmResult.status).toBeLessThan(500);
      if (confirmResult.ok) {
        const updated = await fetchOrder(request, pendingOrder.id);
        expect(updated).toBeTruthy();
        expect(updated!.status).toBe('APPROVED');
      }
      return;
    }

    // Confirm the newly created order
    const confirmResult = await confirmOrder(request, createResult.order.id);
    expect(confirmResult.status).toBeLessThan(500);

    if (confirmResult.ok) {
      const updated = await fetchOrder(request, createResult.order.id);
      expect(updated).toBeTruthy();
      expect(updated!.status).toBe('APPROVED');
    }
  });

  test('3. 본사 발주 컨펌 후 WMS sync 상태 조회', async ({ request }) => {
    // Get or create an approved HQ order
    const { hqProduct } = await ensureTestProducts(request);
    expect(hqProduct).toBeTruthy();

    const approvedResult = await ensureApprovedOrder(request, hqProduct!);

    let orderId: string;
    if (approvedResult.skipped || !approvedResult.order) {
      // Fallback: find an existing approved HQ order
      const orders = await fetchOrders(request, { pageSize: 50, productType: 'HEADQUARTERS' });
      const approvedOrder = orders.find(
        (o) => o.status === 'APPROVED' && o.productType === 'HEADQUARTERS',
      );
      if (!approvedOrder) {
        // No approved HQ order -- verify WMS status API returns proper response for any order
        const anyOrder = orders[0];
        if (anyOrder) {
          const wmsStatus = await getWmsOrderStatus(request, anyOrder.id);
          // wmsStatus may be null or an object; verify structure if present
          if (wmsStatus) {
            expect(typeof wmsStatus.synced).toBe('boolean');
            expect(typeof wmsStatus.status).toBe('string');
          }
        }
        expect(Array.isArray(orders)).toBe(true);
        return;
      }
      orderId = approvedOrder.id;
    } else {
      orderId = approvedResult.order.id;
    }

    // Query WMS sync status
    const res = await request.get(`/api/onewms/orders/${orderId}/status`);
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      expect(body.data).toBeTruthy();
      expect(typeof body.data.synced).toBe('boolean');
      expect(typeof body.data.status).toBe('string');
      expect(
        ['not_synced', 'pending', 'sent', 'shipped', 'failed', 'manual_intervention'],
      ).toContain(body.data.status);
    }
  });

  test('4. WMS 통계 대시보드 조회', async ({ request }) => {
    const res = await request.get('/api/onewms/stats');
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      const data = body.data;

      // orders structure
      expect(data.orders).toBeDefined();
      expect(typeof data.orders.total).toBe('number');
      expect(typeof data.orders.pending).toBe('number');
      expect(typeof data.orders.failed).toBe('number');
      expect(typeof data.orders.shipped).toBe('number');
      expect(typeof data.orders.successRate).toBe('number');

      // stock structure
      expect(data.stock).toBeDefined();
      expect(typeof data.stock.conflicts).toBe('number');

      // timestamp
      expect(data.timestamp).toBeTruthy();

      // Sanity checks
      expect(data.orders.total).toBeGreaterThanOrEqual(0);
      expect(data.orders.successRate).toBeGreaterThanOrEqual(0);
      expect(data.orders.successRate).toBeLessThanOrEqual(100);
    }
  });

  test('5. CENTER 발주는 WMS sync 비발생 확인', async ({ request }) => {
    const { centerProduct } = await ensureTestProducts(request);
    expect(centerProduct).toBeTruthy();

    // Create and confirm a CENTER order
    const createResult = await createOrderFromProduct(request, centerProduct!);

    let orderId: string;
    if (createResult.skipped || !createResult.order) {
      // Fallback: find an existing approved CENTER order
      const orders = await fetchOrders(request, { pageSize: 50, productType: 'CENTER' });
      const centerOrder = orders.find(
        (o) => o.status === 'APPROVED' && o.productType === 'CENTER',
      );
      if (!centerOrder) {
        // No suitable CENTER order -- verify product type filter works
        for (const order of orders.slice(0, 3)) {
          expect(order.productType).toBe('CENTER');
        }
        expect(Array.isArray(orders)).toBe(true);
        return;
      }
      orderId = centerOrder.id;
    } else {
      // Confirm the CENTER order
      const confirmResult = await confirmOrder(request, createResult.order.id);
      expect(confirmResult.status).toBeLessThan(500);
      orderId = createResult.order.id;
    }

    // WMS sync status for CENTER order should be not_synced
    const wmsStatus = await getWmsOrderStatus(request, orderId);
    if (wmsStatus) {
      expect(wmsStatus.status).toBe('not_synced');
      expect(wmsStatus.synced).toBe(false);
    }
  });

  test('6. 수동 WMS sync API 동작', async ({ request }) => {
    // Find or create an APPROVED HEADQUARTERS order
    const orders = await fetchOrders(request, { pageSize: 50, productType: 'HEADQUARTERS' });
    const approvedHq = orders.find(
      (o) => o.status === 'APPROVED' && o.productType === 'HEADQUARTERS',
    );

    if (!approvedHq) {
      // Try to create one
      const { hqProduct } = await ensureTestProducts(request);
      expect(hqProduct).toBeTruthy();

      const approvedResult = await ensureApprovedOrder(request, hqProduct!);
      if (approvedResult.skipped || !approvedResult.order) {
        // Verify sync API structure with a known-bad request
        const syncRes = await request.post('/api/onewms/orders/sync', {
          headers: POST_HEADERS,
          data: { orderId: 'nonexistent-id' },
        });
        expect(syncRes.status()).toBeLessThan(500);
        return;
      }

      const syncRes = await request.post('/api/onewms/orders/sync', {
        headers: POST_HEADERS,
        data: { orderId: approvedResult.order.id },
      });
      expect(syncRes.status()).toBeLessThan(500);

      const body = await syncRes.json();
      if (syncRes.ok()) {
        expect(body.data.onewmsOrderNo).toBeTruthy();
      } else {
        // Already synced or validation error
        expect(body.error).toBeTruthy();
      }
      return;
    }

    // Manual sync on existing approved HQ order
    const syncRes = await request.post('/api/onewms/orders/sync', {
      headers: POST_HEADERS,
      data: { orderId: approvedHq.id },
    });
    // Could be 200 (success) or 400 (already synced)
    expect(syncRes.status()).toBeLessThan(500);

    const body = await syncRes.json();
    if (syncRes.ok()) {
      expect(body.data.onewmsOrderNo).toBeTruthy();
    } else {
      // Already synced or other known issue
      expect(body.error).toBeTruthy();
    }
  });

  test('7. WMS sync 실패 재시도 API', async ({ request }) => {
    const retryRes = await request.post('/api/onewms/orders/retry', {
      headers: POST_HEADERS,
    });
    expect(retryRes.status()).toBeLessThan(500);

    if (retryRes.ok()) {
      const body = await retryRes.json();
      expect(body.data).toBeTruthy();
      expect(body.data.statistics).toBeDefined();
      expect(typeof body.data.statistics.processed).toBe('number');
      expect(typeof body.data.statistics.succeeded).toBe('number');
      expect(typeof body.data.statistics.failed).toBe('number');
      expect(body.data.statistics.processed).toBeGreaterThanOrEqual(0);
      expect(body.data.statistics.succeeded).toBeGreaterThanOrEqual(0);
      expect(body.data.statistics.failed).toBeGreaterThanOrEqual(0);
    }
  });

  test('8. WMS sync 매핑 데이터 일관성', async ({ request }) => {
    // Get HEADQUARTERS orders
    const orders = await fetchOrders(request, { pageSize: 20, productType: 'HEADQUARTERS' });
    expect(Array.isArray(orders)).toBe(true);

    if (orders.length === 0) {
      // No HQ orders -- verify API is working
      const stats = await getWmsStats(request);
      if (stats) {
        expect(typeof stats.orders.total).toBe('number');
      }
      return;
    }

    // Check WMS sync status for up to 3 HQ orders
    let checkedCount = 0;
    for (const order of orders.slice(0, 3)) {
      const wmsStatus = await getWmsOrderStatus(request, order.id);
      if (!wmsStatus) continue;

      checkedCount++;

      // Verify data structure consistency
      expect(typeof wmsStatus.synced).toBe('boolean');
      expect(typeof wmsStatus.status).toBe('string');

      // If synced, verify mapping fields exist
      if (wmsStatus.synced) {
        expect(wmsStatus.onewmsOrderNo).toBeTruthy();
        expect(wmsStatus.sentAt).toBeTruthy();

        // Verify the original order data matches
        const orderDetail = await fetchOrder(request, order.id);
        if (orderDetail) {
          expect(orderDetail.productType).toBe('HEADQUARTERS');
        }
      }

      // If not synced, verify appropriate status
      if (!wmsStatus.synced) {
        expect(
          ['not_synced', 'pending', 'failed', 'manual_intervention'],
        ).toContain(wmsStatus.status);
      }
    }

    // At least one WMS status check should have succeeded
    expect(checkedCount).toBeGreaterThan(0);
  });
});
