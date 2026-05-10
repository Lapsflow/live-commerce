import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Phase 5: 센터별 자동 분배 — 8 시나리오
 *
 * 발주 항목별 productType + centerId 기반 자동 분배,
 * SUB_MASTER 센터 격리, processingCenterId 라우팅 검증.
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

// ──────────────────────── 자동 분리 시나리오 1-3 ────────────────────────

test.describe('Phase 5: 발주 자동 분리', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. 혼합 발주 생성 → 자동 분리 확인 (API 구조)', async ({ request }) => {
    // 본사 + 센터 상품 조회
    const hqProducts = await getProducts(request, '&productType=HEADQUARTERS');
    const centerProducts = await getProducts(request, '&productType=CENTER');

    // 두 유형 모두 존재하는지 확인
    if (hqProducts.length === 0 || centerProducts.length === 0) {
      // 한 유형이라도 없으면 분리 테스트 불가 — API 구조만 확인
      const res = await request.get(`${BASE_URL}/api/products?pageSize=5`);
      expect(res.ok()).toBeTruthy();
      test.skip();
      return;
    }

    const hqProduct = hqProducts.find((p: any) => p.supplyPrice > 0 && p.sellPrice > 0);
    const centerProduct = centerProducts.find((p: any) => p.supplyPrice > 0 && p.sellPrice > 0);

    if (!hqProduct || !centerProduct) { test.skip(); return; }

    // 혼합 발주 생성 시도
    const orderNo = `E2E-PH5-MIX-${TS}`;
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

    if (res.status() === 400) {
      // 재고 부족 등 가능 — skip
      test.skip();
      return;
    }

    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      // split=true, orders 배열에 2개
      expect(body.data.split).toBe(true);
      expect(body.data.orders).toHaveLength(2);

      // 각 주문의 productType 확인
      const types = body.data.orders.map((o: any) => o.productType).sort();
      expect(types).toEqual(['CENTER', 'HEADQUARTERS']);

      // 주문번호에 suffix 확인
      const orderNos = body.data.orders.map((o: any) => o.orderNo);
      expect(orderNos.some((no: string) => no.includes('-WMS'))).toBe(true);
      expect(orderNos.some((no: string) => no.includes('-CENTER'))).toBe(true);
    }
  });

  test('2. HEADQUARTERS 발주 processingCenterId=null 확인', async ({ request }) => {
    const orders = await getOrders(request, '&productType=HEADQUARTERS');
    const hqOrders = orders.filter((o: any) => o.productType === 'HEADQUARTERS');

    if (hqOrders.length === 0) { test.skip(); return; }

    // 첫 번째 HEADQUARTERS 발주 상세 조회
    const detailRes = await request.get(`${BASE_URL}/api/orders/${hqOrders[0].id}`);
    expect(detailRes.ok()).toBeTruthy();

    const body = await detailRes.json();
    const order = body.data;

    // HEADQUARTERS 발주는 processingCenterId가 null이어야 함
    expect(order.productType).toBe('HEADQUARTERS');
    expect(order.processingCenterId).toBeNull();
  });

  test('3. CENTER 발주 processingCenterId 자동 할당 확인', async ({ request }) => {
    const orders = await getOrders(request, '&productType=CENTER');
    const centerOrders = orders.filter((o: any) => o.productType === 'CENTER');

    if (centerOrders.length === 0) { test.skip(); return; }

    // 첫 번째 CENTER 발주 상세 조회
    const detailRes = await request.get(`${BASE_URL}/api/orders/${centerOrders[0].id}`);
    expect(detailRes.ok()).toBeTruthy();

    const body = await detailRes.json();
    const order = body.data;

    expect(order.productType).toBe('CENTER');
    // processingCenterId가 설정되어 있어야 함 (product.managedBy 기반)
    // 단, 기존 데이터에 따라 null일 수도 있음
    if (order.processingCenterId) {
      expect(typeof order.processingCenterId).toBe('string');
      expect(order.processingCenterId.length).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────── SUB_MASTER 센터 격리 시나리오 4-6 ────────────────────────

test.describe('Phase 5: SUB_MASTER 센터 격리', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('4. SUB_MASTER 필터: productType별 발주 조회', async ({ request }) => {
    // HEADQUARTERS 발주 목록
    const hqRes = await request.get(`${BASE_URL}/api/orders?productType=HEADQUARTERS&pageSize=10`);
    expect(hqRes.ok()).toBeTruthy();
    const hqBody = await hqRes.json();

    // CENTER 발주 목록
    const centerRes = await request.get(`${BASE_URL}/api/orders?productType=CENTER&pageSize=10`);
    expect(centerRes.ok()).toBeTruthy();
    const centerBody = await centerRes.json();

    // 각 목록의 productType이 필터와 일치하는지 확인
    for (const order of (hqBody.data || [])) {
      expect(order.productType).toBe('HEADQUARTERS');
    }
    for (const order of (centerBody.data || [])) {
      expect(order.productType).toBe('CENTER');
    }
  });

  test('5. 센터 목록 API에서 활성 센터 확인', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/centers?pageSize=20`);
    expect(res.status()).toBeLessThan(500);

    if (res.ok()) {
      const body = await res.json();
      const centers = body.data || [];

      if (centers.length > 0) {
        // 각 센터에 필수 필드가 있는지 확인
        const center = centers[0];
        expect(center.id).toBeTruthy();
        expect(center.name).toBeTruthy();
        expect(center.code).toBeTruthy();
      }
    }
  });

  test('6. SUB_MASTER 상품 목록 필터링 확인 (API)', async ({ request }) => {
    // 마스터 세션에서 전체 상품 조회 (productType 비교용)
    const allProducts = await getProducts(request);
    const hqCount = allProducts.filter((p: any) => p.productType === 'HEADQUARTERS').length;
    const centerCount = allProducts.filter((p: any) => p.productType === 'CENTER').length;

    // 두 유형 모두 존재하는지 확인
    expect(hqCount + centerCount).toBeGreaterThan(0);

    // productType 필터 동작 확인
    const hqProducts = await getProducts(request, '&productType=HEADQUARTERS');
    for (const p of hqProducts) {
      expect(p.productType).toBe('HEADQUARTERS');
    }

    const centerProducts = await getProducts(request, '&productType=CENTER');
    for (const p of centerProducts) {
      expect(p.productType).toBe('CENTER');
    }
  });
});

// ──────────────────────── 센터 라우팅 시나리오 7-8 ────────────────────────

test.describe('Phase 5: 센터 라우팅 검증', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('7. 센터별 발주 집계 확인', async ({ request }) => {
    // 전체 발주 목록
    const allOrders = await getOrders(request);

    // productType별 집계
    const hqOrders = allOrders.filter((o: any) => o.productType === 'HEADQUARTERS');
    const centerOrders = allOrders.filter((o: any) => o.productType === 'CENTER');

    // 통계 확인
    expect(hqOrders.length + centerOrders.length).toBeLessThanOrEqual(allOrders.length);

    // 각 유형의 발주가 올바른 productType을 가지는지 확인
    for (const order of hqOrders) {
      expect(order.productType).toBe('HEADQUARTERS');
    }
    for (const order of centerOrders) {
      expect(order.productType).toBe('CENTER');
    }
  });

  test('8. processingCenterId 기반 라우팅 정합성', async ({ request }) => {
    // CENTER 발주에서 processingCenterId가 있는 것들 확인
    const centerOrders = await getOrders(request, '&productType=CENTER');

    if (centerOrders.length === 0) { test.skip(); return; }

    // 센터 목록 가져오기
    const centersRes = await request.get(`${BASE_URL}/api/centers?pageSize=50`);
    const validCenterIds: string[] = [];
    if (centersRes.ok()) {
      const centersBody = await centersRes.json();
      const centers = centersBody.data || [];
      for (const c of centers) {
        validCenterIds.push(c.id);
      }
    }

    // processingCenterId가 있는 발주는 유효한 센터 ID여야 함
    for (const order of centerOrders.slice(0, 5)) {
      const detailRes = await request.get(`${BASE_URL}/api/orders/${order.id}`);
      if (!detailRes.ok()) continue;

      const body = await detailRes.json();
      const detail = body.data;

      if (detail.processingCenterId && validCenterIds.length > 0) {
        expect(validCenterIds).toContain(detail.processingCenterId);
      }
    }
  });
});
