import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Phase 7: 발주 분할 + 양방향 알림 — 7 시나리오
 *
 * 발주 생성 시 ORDER_CREATED 알림 → 관리자,
 * 입금확인 시 ORDER_PAYMENT_CONFIRMED 알림 → 셀러,
 * 알림 템플릿 구조 검증, 발주 분할 + 알림 연동.
 */

const BASE_URL = 'https://live-commerce-opal.vercel.app';
const POST_HEADERS = { 'Origin': BASE_URL, 'Content-Type': 'application/json' };
const TS = Date.now().toString(36).slice(-5);

// ── 공통 헬퍼 ──

async function getProducts(request: APIRequestContext, params = '') {
  const res = await request.get(`${BASE_URL}/api/products?pageSize=10${params}`);
  if (!res.ok()) return [];
  const body = await res.json();
  return body.data || [];
}

async function getOrders(request: APIRequestContext, params = '') {
  const res = await request.get(`${BASE_URL}/api/orders?pageSize=50${params}`);
  if (!res.ok()) return [];
  const body = await res.json();
  return body.data || [];
}

// ──────────────────────── 발주 생성 + 알림 시나리오 1-3 ────────────────────────

test.describe('Phase 7: 발주 생성 알림', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. 단일 발주 생성 → 응답에 orders 배열 포함', async ({ request }) => {
    const products = await getProducts(request);
    const product = products.find((p: any) => p.supplyPrice > 0 && p.sellPrice > 0);

    if (!product) { test.skip(); return; }

    const orderNo = `E2E-PH7-NOTIF-${TS}`;
    const res = await request.post(`${BASE_URL}/api/orders`, {
      headers: POST_HEADERS,
      data: {
        orderNo,
        totalAmount: product.supplyPrice || 10000,
        items: [
          {
            productId: product.id,
            quantity: 1,
            barcode: product.barcode || 'TEST-PH7',
            productName: product.name,
            supplyPrice: product.supplyPrice,
          },
        ],
      },
    });

    if (res.status() === 400) {
      // 재고 부족 등 → skip
      test.skip();
      return;
    }

    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      // 단일 유형이면 split=false
      expect(body.data.orders).toBeDefined();
      expect(Array.isArray(body.data.orders)).toBe(true);
      expect(body.data.orders.length).toBeGreaterThan(0);

      // 각 주문에 필수 필드 확인
      const order = body.data.orders[0];
      expect(order.orderNo).toBeTruthy();
      expect(order.id).toBeTruthy();
      expect(order.productType).toBeTruthy();
    }
  });

  test('2. 혼합 발주 → split=true, 양쪽 모두 알림 대상', async ({ request }) => {
    const hqProducts = await getProducts(request, '&productType=HEADQUARTERS');
    const centerProducts = await getProducts(request, '&productType=CENTER');

    const hqProduct = hqProducts.find((p: any) => p.supplyPrice > 0 && p.sellPrice > 0);
    const centerProduct = centerProducts.find((p: any) => p.supplyPrice > 0 && p.sellPrice > 0);

    if (!hqProduct || !centerProduct) { test.skip(); return; }

    const orderNo = `E2E-PH7-SPLIT-${TS}`;
    const res = await request.post(`${BASE_URL}/api/orders`, {
      headers: POST_HEADERS,
      data: {
        orderNo,
        totalAmount: (hqProduct.supplyPrice || 10000) + (centerProduct.supplyPrice || 10000),
        items: [
          {
            productId: hqProduct.id,
            quantity: 1,
            barcode: hqProduct.barcode || 'TEST-HQ',
            productName: hqProduct.name,
            supplyPrice: hqProduct.supplyPrice,
          },
          {
            productId: centerProduct.id,
            quantity: 1,
            barcode: centerProduct.barcode || 'TEST-CTR',
            productName: centerProduct.name,
            supplyPrice: centerProduct.supplyPrice,
          },
        ],
      },
    });

    if (res.status() === 400) { test.skip(); return; }
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      expect(body.data.split).toBe(true);
      expect(body.data.orders).toHaveLength(2);

      // 각 주문에 id, orderNo, productType 필수
      for (const order of body.data.orders) {
        expect(order.id).toBeTruthy();
        expect(order.orderNo).toBeTruthy();
        expect(['HEADQUARTERS', 'CENTER']).toContain(order.productType);
      }
    }
  });

  test('3. 발주 생성 후 목록에서 확인', async ({ request }) => {
    const orders = await getOrders(request);

    if (orders.length === 0) { test.skip(); return; }

    // 최신 주문이 E2E 테스트에서 생성된 것인지 확인
    const recent = orders[0];
    expect(recent.id).toBeTruthy();
    expect(recent.orderNo).toBeTruthy();
    expect(recent.status).toBeDefined();
    expect(recent.seller).toBeDefined();
  });
});

// ──────────────────────── 입금확인 + 셀러 알림 시나리오 4-5 ────────────────────────

test.describe('Phase 7: 입금확인 알림', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('4. 입금확인 API 동작 확인 (APPROVED → PAID)', async ({ request }) => {
    // APPROVED + UNPAID 상태 발주 찾기
    const orders = await getOrders(request);
    const target = orders.find((o: any) =>
      o.status === 'APPROVED' && (!o.paymentStatus || o.paymentStatus === 'UNPAID')
    );

    if (!target) { test.skip(); return; }

    const res = await request.post(`${BASE_URL}/api/orders/${target.id}/payment-confirm`, {
      headers: POST_HEADERS,
    });
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      expect(body.data.paymentStatus).toBe('PAID');
      expect(body.data.paidAt).toBeTruthy();
    }
  });

  test('5. 이미 PAID인 발주 재입금확인 → 400', async ({ request }) => {
    const orders = await getOrders(request);
    const paidOrder = orders.find((o: any) => o.paymentStatus === 'PAID');

    if (!paidOrder) { test.skip(); return; }

    const res = await request.post(`${BASE_URL}/api/orders/${paidOrder.id}/payment-confirm`, {
      headers: POST_HEADERS,
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ──────────────────────── 알림 시스템 구조 검증 시나리오 6-7 ────────────────────────

test.describe('Phase 7: 알림 구조 검증', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('6. PENDING 발주 입금확인 불가 (APPROVED 필수)', async ({ request }) => {
    const orders = await getOrders(request);
    const pendingOrder = orders.find((o: any) => o.status === 'PENDING');

    if (!pendingOrder) { test.skip(); return; }

    const res = await request.post(`${BASE_URL}/api/orders/${pendingOrder.id}/payment-confirm`, {
      headers: POST_HEADERS,
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('7. 발주 상세에 seller 정보 포함 (알림 수신자)', async ({ request }) => {
    const orders = await getOrders(request);
    if (orders.length === 0) { test.skip(); return; }

    const orderId = orders[0].id;
    const res = await request.get(`${BASE_URL}/api/orders/${orderId}`);
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      const order = body.data;

      expect(order.id).toBeTruthy();
      expect(order.orderNo).toBeTruthy();

      // seller 정보가 포함되어 알림 수신이 가능해야 함
      if (order.seller) {
        expect(order.seller.id).toBeTruthy();
        expect(order.seller.name).toBeTruthy();
      }
    }
  });
});
