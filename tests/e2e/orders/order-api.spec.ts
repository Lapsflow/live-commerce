import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Orders API - Admin', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  // ─── GET /api/orders/stats ─────────────────────
  test.describe('GET /api/orders/stats', () => {
    test('응답 구조가 올바름', async () => {
      const { response, data } = await api.getStats();
      expect(response.ok()).toBeTruthy();
      expect(data.data).toHaveProperty('pendingUnpaid');
      expect(data.data).toHaveProperty('approvedPreparing');
      expect(data.data).toHaveProperty('shipped');
      expect(data.data).toHaveProperty('rejected');
      expect(data.data).toHaveProperty('expiringSoon');
      expect(data.data).toHaveProperty('total');
    });

    test('모든 값이 0 이상의 숫자', async () => {
      const { data } = await api.getStats();
      const d = data.data;
      expect(typeof d.pendingUnpaid).toBe('number');
      expect(typeof d.approvedPreparing).toBe('number');
      expect(typeof d.shipped).toBe('number');
      expect(typeof d.rejected).toBe('number');
      expect(typeof d.expiringSoon).toBe('number');
      expect(typeof d.total).toBe('number');
      expect(d.pendingUnpaid).toBeGreaterThanOrEqual(0);
      expect(d.total).toBeGreaterThanOrEqual(0);
    });

    test('total = pendingUnpaid + approvedPreparing + shipped + rejected', async () => {
      const { data } = await api.getStats();
      const d = data.data;
      expect(d.total).toBe(d.pendingUnpaid + d.approvedPreparing + d.shipped + d.rejected);
    });
  });

  // ─── GET /api/orders ───────────────────────────
  test.describe('GET /api/orders', () => {
    test('주문 목록 반환 (페이지네이션)', async () => {
      const { response, data } = await api.getOrders();
      expect(response.ok()).toBeTruthy();
      expect(Array.isArray(data.data)).toBeTruthy();
      expect(typeof data.totalCount).toBe('number');
    });

    test('pageSize 파라미터 적용', async () => {
      const { data } = await api.getOrders({ pageSize: 3 });
      expect(data.data.length).toBeLessThanOrEqual(3);
    });

    test('각 주문에 seller 정보 포함', async () => {
      const { data } = await api.getOrders({ pageSize: 5 });
      if (data.data.length > 0) {
        const order = data.data[0];
        expect(order.seller).toBeDefined();
        expect(order.seller.name).toBeDefined();
      }
    });

    test('search 파라미터로 주문번호 검색', async () => {
      const { data: allData } = await api.getOrders({ pageSize: 1 });
      if (allData.data.length === 0) return;

      const orderNo = allData.data[0].orderNo;
      const { data: searchData } = await api.getOrders({ search: orderNo });
      expect(searchData.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── GET /api/orders/:id ───────────────────────
  test.describe('GET /api/orders/:id', () => {
    test('접근 가능한 주문 상세 정보 반환', async () => {
      const { data: list } = await api.getOrders({ pageSize: 20 });
      test.skip(list.data.length === 0, 'No orders available');

      // ADMIN can only see orders from assigned sellers, try multiple
      let found = false;
      for (const order of list.data) {
        const { response, data } = await api.getOrder(order.id);
        if (response.ok()) {
          expect(data.data.id).toBe(order.id);
          expect(data.data.orderNo).toBeDefined();
          expect(data.data.status).toBeDefined();
          expect(data.data.paymentStatus).toBeDefined();
          found = true;
          break;
        }
      }
      test.skip(!found, 'No accessible order detail for this admin');
    });

    test('items에 product 상세 포함', async () => {
      const { data: list } = await api.getOrders({ pageSize: 20 });
      test.skip(list.data.length === 0, 'No orders available');

      for (const order of list.data) {
        const { response, data } = await api.getOrder(order.id);
        if (response.ok() && data.data.items?.length > 0) {
          const item = data.data.items[0];
          expect(item.barcode).toBeDefined();
          expect(item.productName).toBeDefined();
          expect(typeof item.quantity).toBe('number');
          return;
        }
      }
    });

    test('존재하지 않는 ID는 에러 반환', async () => {
      const { response } = await api.getOrder('clxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(response.ok()).toBeFalsy();
    });
  });

  // ─── POST /api/orders/:id/confirm-payment ──────
  test.describe('POST /api/orders/:id/confirm-payment', () => {
    test('PENDING+UNPAID 주문 입금확인 성공', async () => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      const { response, data } = await api.confirmPayment(order.id);
      expect(response.ok()).toBeTruthy();
      expect(data.data.message).toBe('입금이 확인되었습니다.');
      expect(data.data.orderId).toBe(order.id);
      expect(data.data.wmsSync).toBeDefined();
    });

    test('이미 PAID인 주문 입금확인 실패', async () => {
      const order = await api.findApprovedPaidOrder();
      test.skip(!order, 'No APPROVED+PAID order available');

      const { response } = await api.confirmPayment(order.id);
      expect(response.ok()).toBeFalsy();
    });

    test('REJECTED 주문 입금확인 실패', async () => {
      const order = await api.findRejectedOrder();
      test.skip(!order, 'No REJECTED order available');

      const { response } = await api.confirmPayment(order.id);
      expect(response.ok()).toBeFalsy();
    });

    test('존재하지 않는 주문 입금확인 실패', async () => {
      const { response } = await api.confirmPayment('clxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(response.ok()).toBeFalsy();
    });
  });

  // ─── POST /api/orders/:id/cancel ───────────────
  test.describe('POST /api/orders/:id/cancel', () => {
    test('PENDING+UNPAID 주문 취소 성공', async () => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      const { response, data } = await api.cancelOrder(order.id);
      expect(response.ok()).toBeTruthy();
      expect(data.data.message).toBe('발주가 취소되었습니다.');
      expect(data.data.orderId).toBe(order.id);
      expect(typeof data.data.released).toBe('number');
    });

    test('PAID 주문 취소 불가', async () => {
      const order = await api.findApprovedPaidOrder();
      test.skip(!order, 'No PAID order available');

      const { response } = await api.cancelOrder(order.id);
      expect(response.ok()).toBeFalsy();
    });

    test('이미 REJECTED 주문 취소 불가', async () => {
      const order = await api.findRejectedOrder();
      test.skip(!order, 'No REJECTED order available');

      const { response } = await api.cancelOrder(order.id);
      expect(response.ok()).toBeFalsy();
    });

    test('취소 후 cancelReason이 ADMIN_CANCELLED', async () => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      await api.cancelOrder(order.id);
      const { data } = await api.getOrder(order.id);
      expect(data.data.cancelReason).toBe('ADMIN_CANCELLED');
      expect(data.data.status).toBe('REJECTED');
    });
  });
});
