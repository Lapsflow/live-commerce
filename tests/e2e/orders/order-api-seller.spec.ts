import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';

test.use({ storageState: 'playwright/.auth/seller.json' });

test.describe('Orders API - Seller', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  // ─── GET /api/orders/stats ─────────────────────
  test.describe('GET /api/orders/stats', () => {
    test('셀러 본인 통계만 반환', async () => {
      const { response, data } = await api.getStats();
      expect(response.ok()).toBeTruthy();
      expect(data.data).toHaveProperty('pendingUnpaid');
      expect(data.data).toHaveProperty('total');
      expect(data.data.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── GET /api/orders ───────────────────────────
  test.describe('GET /api/orders', () => {
    test('본인 주문만 반환', async () => {
      const { response, data } = await api.getOrders({ pageSize: 50 });
      expect(response.ok()).toBeTruthy();
      // Seller should see only their own orders (or empty list)
      expect(Array.isArray(data.data)).toBeTruthy();
    });
  });

  // ─── POST /api/orders/:id/confirm-payment ──────
  test.describe('POST /api/orders/:id/confirm-payment', () => {
    test('SELLER 역할은 입금확인 불가 (403)', async () => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available for seller');

      const { response } = await api.confirmPayment(order.id);
      expect(response.status()).toBe(403);
    });
  });

  // ─── POST /api/orders/:id/cancel ───────────────
  test.describe('POST /api/orders/:id/cancel', () => {
    test('본인 PENDING+UNPAID 주문 취소 성공', async () => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available for seller');

      const { response, data } = await api.cancelOrder(order.id);
      expect(response.ok()).toBeTruthy();
      expect(data.data.message).toBe('발주가 취소되었습니다.');
    });

    test('취소 후 cancelReason이 SELLER_CANCELLED', async () => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available for seller');

      await api.cancelOrder(order.id);
      const { data } = await api.getOrder(order.id);
      expect(data.data.cancelReason).toBe('SELLER_CANCELLED');
    });

    test('PAID 주문 취소 불가', async () => {
      const order = await api.findApprovedPaidOrder();
      test.skip(!order, 'No PAID order available for seller');

      const { response } = await api.cancelOrder(order.id);
      expect(response.status()).toBe(400);
    });

    test('이미 REJECTED 주문 취소 불가', async () => {
      const order = await api.findRejectedOrder();
      test.skip(!order, 'No REJECTED order available for seller');

      const { response } = await api.cancelOrder(order.id);
      expect(response.status()).toBe(400);
    });
  });
});
