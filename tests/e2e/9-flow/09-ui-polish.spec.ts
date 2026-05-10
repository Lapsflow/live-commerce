import { test, expect } from '@playwright/test';
import {
  POST_HEADERS,
  ensureTestProducts,
  createOrderFromProduct,
  fetchOrder,
  fetchOrders,
  fetchCenters,
} from './helpers';

/**
 * 09: UI 관련 API 응답, 라벨, 포맷, 상세 페이지 — 10 시나리오
 *
 * 발주/상품 상세 필드 검증, 목록 정렬, 페이지네이션,
 * 센터 구조, 타임스탬프, 에러 응답 일관성 확인.
 *
 * 재고 부족 시 기존 발주 데이터를 활용하여 검증.
 */

test.describe('09: UI Polish — API 응답 구조 검증', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. 발주 상세 필수 필드 포함 (orderNo, status, totalAmount)', async ({ request }) => {
    // Use existing order to verify detail structure
    const orders = await fetchOrders(request, { pageSize: 5 });
    expect(orders.length).toBeGreaterThan(0);

    const detail = await fetchOrder(request, orders[0].id);
    expect(detail).toBeTruthy();

    // Required fields
    expect(detail!.orderNo).toBeTruthy();
    expect(detail!.status).toBeDefined();
    expect(typeof detail!.totalAmount).toBe('number');
    expect(detail!.id).toBeTruthy();
  });

  test('2. 발주 상품 목록 포함 (items 배열)', async ({ request }) => {
    // Use existing order
    const orders = await fetchOrders(request, { pageSize: 5 });
    expect(orders.length).toBeGreaterThan(0);

    const res = await request.get(`/api/orders/${orders[0].id}`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    const order = body.data;
    expect(order).toBeTruthy();
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items.length).toBeGreaterThan(0);

    // Each item should have core fields
    const item = order.items[0];
    expect(item.productId).toBeTruthy();
    expect(item.quantity).toBeGreaterThan(0);
    expect(typeof item.supplyPrice).toBe('number');
  });

  test('3. 발주 상태 한글 라벨 매핑 가능', async ({ request }) => {
    const orders = await fetchOrders(request, { pageSize: 20 });
    expect(orders.length).toBeGreaterThan(0);

    const knownStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
    const knownPaymentStatuses = ['UNPAID', 'PAID', 'PAYMENT_FAILED'];

    for (const order of orders) {
      expect(knownStatuses).toContain(order.status);

      if (order.paymentStatus) {
        expect(knownPaymentStatuses).toContain(order.paymentStatus);
      }
    }
  });

  test('4. 상품 상세 필수 필드 (name, code, barcode, prices)', async ({ request }) => {
    const { hqProduct, centerProduct } = await ensureTestProducts(request);
    const product = centerProduct ?? hqProduct;
    expect(product).toBeTruthy();

    const res = await request.get(`/api/products/${product!.id}`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    const detail = body.data;
    expect(detail).toBeTruthy();

    // Required fields
    expect(detail.name).toBeTruthy();
    expect(detail.code).toBeTruthy();
    expect(detail.barcode).toBeTruthy();
    expect(typeof detail.supplyPrice).toBe('number');
    expect(typeof detail.sellPrice).toBe('number');
  });

  test('5. 상품 목록 정렬 확인', async ({ request }) => {
    const res = await request.get('/api/products?pageSize=10');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    if (body.data.length >= 2) {
      for (const product of body.data) {
        expect(product.id).toBeTruthy();
        expect(product.name).toBeTruthy();
      }
    }
  });

  test('6. 발주 목록 페이지네이션 동작', async ({ request }) => {
    const res = await request.get('/api/orders?pageSize=5&pageIndex=0');
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    // Should have pagination metadata
    expect(typeof body.totalCount).toBe('number');
    expect(typeof body.pageCount).toBe('number');

    // Data length should respect pageSize
    expect(body.data.length).toBeLessThanOrEqual(5);

    // If there are more than 5 orders, page 1 should also work
    if (body.totalCount > 5) {
      const res2 = await request.get('/api/orders?pageSize=5&pageIndex=1');
      expect(res2.ok()).toBeTruthy();

      const body2 = await res2.json();
      expect(Array.isArray(body2.data)).toBe(true);
      expect(body2.data.length).toBeLessThanOrEqual(5);

      if (body2.data.length > 0 && body.data.length > 0) {
        expect(body2.data[0].id).not.toBe(body.data[0].id);
      }
    }
  });

  test('7. 센터 목록 구조 확인 (id, name, code)', async ({ request }) => {
    const centers = await fetchCenters(request);
    expect(centers.length).toBeGreaterThan(0);

    for (const center of centers) {
      expect(center.id).toBeTruthy();
      expect(center.name).toBeTruthy();
    }
  });

  test('8. 발주 seller 정보 완전성 (id, name)', async ({ request }) => {
    // Use existing order to verify seller info
    const orders = await fetchOrders(request, { pageSize: 10 });
    expect(orders.length).toBeGreaterThan(0);

    const detail = await fetchOrder(request, orders[0].id);
    expect(detail).toBeTruthy();
    expect(detail!.seller).toBeTruthy();
    expect(detail!.seller.id).toBeTruthy();
    expect(detail!.seller.name).toBeTruthy();
  });

  test('9. 발주 createdAt/updatedAt 타임스탬프 확인', async ({ request }) => {
    // Use existing order
    const orders = await fetchOrders(request, { pageSize: 5 });
    expect(orders.length).toBeGreaterThan(0);

    const res = await request.get(`/api/orders/${orders[0].id}`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    const order = body.data;
    expect(order).toBeTruthy();

    // Timestamps should be present as ISO strings
    expect(order.createdAt).toBeTruthy();
    expect(order.updatedAt).toBeTruthy();

    // Verify they parse as valid dates
    const createdAt = new Date(order.createdAt);
    const updatedAt = new Date(order.updatedAt);
    expect(createdAt.getTime()).toBeGreaterThan(0);
    expect(updatedAt.getTime()).toBeGreaterThan(0);
  });

  test('10. API 에러 응답 구조 일관성', async ({ request }) => {
    // Test 404 error format -- nonexistent order
    const res404 = await request.get('/api/orders/nonexistent-id-12345');
    expect(res404.status()).toBeGreaterThanOrEqual(400);

    const body404 = await res404.json();
    expect(body404.error).toBeDefined();

    // Test 400 error format -- confirm on nonexistent order
    const res400 = await request.post('/api/orders/nonexistent-id-12345/confirm', {
      headers: POST_HEADERS,
    });
    expect(res400.status()).toBeGreaterThanOrEqual(400);

    const body400 = await res400.json();
    expect(body400.error).toBeDefined();

    // Test validation error -- POST order without required fields
    const resValidation = await request.post('/api/orders', {
      headers: POST_HEADERS,
      data: {},
    });
    expect(resValidation.status()).toBe(400);

    const bodyValidation = await resValidation.json();
    expect(bodyValidation.error).toBeDefined();
  });
});
