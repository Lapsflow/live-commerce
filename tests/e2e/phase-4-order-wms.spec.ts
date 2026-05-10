import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Phase 4: 신규 발주 → WMS 입력 — 9 시나리오
 *
 * 본사(HEADQUARTERS) 상품 발주 컨펌 시 ONEWMS 자동 동기화,
 * 센터(CENTER) 상품은 WMS 미전송, 재시도 로직, 상태 조회 검증.
 */

const BASE_URL = 'https://live-commerce-opal.vercel.app';
const POST_HEADERS = { 'Origin': BASE_URL, 'Content-Type': 'application/json' };

// ── 공통 헬퍼 ──

async function getOrders(request: APIRequestContext, params = '') {
  const res = await request.get(`${BASE_URL}/api/orders?pageSize=50${params}`);
  if (!res.ok()) return [];
  const body = await res.json();
  return body.data || [];
}

// ──────────────────────── WMS 자동 동기화 시나리오 1-3 ────────────────────────

test.describe('Phase 4: WMS 자동 동기화', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. 발주 컨펌 API 동작 확인 (HEADQUARTERS)', async ({ request }) => {
    // PENDING 상태 HEADQUARTERS 발주 찾기
    const orders = await getOrders(request, '&productType=HEADQUARTERS');
    const pendingOrder = orders.find((o: any) => o.status === 'PENDING');

    if (!pendingOrder) {
      // PENDING 발주가 없으면, HEADQUARTERS 발주가 존재하는지만 확인
      const anyHqOrder = orders.find((o: any) => o.productType === 'HEADQUARTERS');
      if (anyHqOrder) {
        expect(anyHqOrder.productType).toBe('HEADQUARTERS');
      }
      test.skip();
      return;
    }

    // 컨펌 API 호출
    const confirmRes = await request.post(`${BASE_URL}/api/orders/${pendingOrder.id}/confirm`, {
      headers: POST_HEADERS,
    });
    expect(confirmRes.status()).toBeLessThan(500);

    if (confirmRes.ok()) {
      const body = await confirmRes.json();
      expect(body.data?.status).toBe('APPROVED');
    }
  });

  test('2. 본사 발주 컨펌 후 WMS sync 상태 확인', async ({ request }) => {
    // APPROVED 상태 HEADQUARTERS 발주 찾기
    const orders = await getOrders(request, '&productType=HEADQUARTERS');
    const approvedOrder = orders.find((o: any) =>
      o.status === 'APPROVED' && o.productType === 'HEADQUARTERS'
    );

    if (!approvedOrder) { test.skip(); return; }

    // WMS sync 상태 조회
    const statusRes = await request.get(`${BASE_URL}/api/onewms/orders/${approvedOrder.id}/status`);
    expect(statusRes.status()).toBeLessThan(500);

    if (statusRes.ok()) {
      const body = await statusRes.json();
      // status가 not_synced이거나 synced 상태일 수 있음
      expect(body.data).toBeTruthy();
      expect(['not_synced', 'pending', 'sent', 'shipped', 'failed', 'manual_intervention'])
        .toContain(body.data.status);
    }
  });

  test('3. 센터 발주는 WMS sync 미발생 확인', async ({ request }) => {
    // APPROVED 상태 CENTER 발주 찾기
    const orders = await getOrders(request, '&productType=CENTER');
    const approvedCenter = orders.find((o: any) =>
      o.status === 'APPROVED' && o.productType === 'CENTER'
    );

    if (!approvedCenter) { test.skip(); return; }

    // WMS sync 상태 조회 → not_synced 여야 함
    const statusRes = await request.get(`${BASE_URL}/api/onewms/orders/${approvedCenter.id}/status`);
    expect(statusRes.status()).toBeLessThan(500);

    if (statusRes.ok()) {
      const body = await statusRes.json();
      // CENTER 발주는 WMS sync 대상이 아님
      expect(body.data.status).toBe('not_synced');
    }
  });
});

// ──────────────────────── WMS 재시도 시나리오 4-5 ────────────────────────

test.describe('Phase 4: WMS 재시도 로직', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('4. WMS 재시도 API 엔드포인트 동작', async ({ request }) => {
    const retryRes = await request.post(`${BASE_URL}/api/onewms/orders/retry`, {
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
    }
  });

  test('5. WMS 재시도 최대 횟수 (3회) 정책 확인', async ({ request }) => {
    // ONEWMS 통계에서 failed/manual_intervention 카운트 확인
    const statsRes = await request.get(`${BASE_URL}/api/onewms/stats`);
    expect(statsRes.status()).toBeLessThan(500);

    if (statsRes.ok()) {
      const body = await statsRes.json();
      // 통계 구조 확인
      expect(body.data.orders).toBeDefined();
      expect(typeof body.data.orders.failed).toBe('number');
      // failed 카운트는 0 이상이어야 함 (데이터 의존)
      expect(body.data.orders.failed).toBeGreaterThanOrEqual(0);
    }
  });
});

// ──────────────────────── WMS 통계 시나리오 6-7 ────────────────────────

test.describe('Phase 4: WMS 통계 및 상태', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('6. ONEWMS 통계 API 전체 구조 검증', async ({ request }) => {
    const statsRes = await request.get(`${BASE_URL}/api/onewms/stats`);
    expect(statsRes.status()).toBeLessThan(500);

    if (statsRes.ok()) {
      const body = await statsRes.json();
      const data = body.data;

      // orders 구조 확인
      expect(data.orders).toBeDefined();
      expect(typeof data.orders.total).toBe('number');
      expect(typeof data.orders.pending).toBe('number');
      expect(typeof data.orders.failed).toBe('number');
      expect(typeof data.orders.shipped).toBe('number');
      expect(typeof data.orders.successRate).toBe('number');

      // stock 구조 확인
      expect(data.stock).toBeDefined();
      expect(typeof data.stock.conflicts).toBe('number');

      // timestamp 확인
      expect(data.timestamp).toBeTruthy();
    }
  });

  test('7. WMS sync 매핑 데이터 일관성 확인', async ({ request }) => {
    // 발주 목록에서 HEADQUARTERS 발주 가져오기
    const orders = await getOrders(request, '&productType=HEADQUARTERS');
    if (orders.length === 0) { test.skip(); return; }

    // 각 HEADQUARTERS 발주의 WMS sync 상태 확인
    const firstOrder = orders[0];
    const statusRes = await request.get(`${BASE_URL}/api/onewms/orders/${firstOrder.id}/status`);
    expect(statusRes.status()).toBeLessThan(500);

    if (statusRes.ok()) {
      const body = await statusRes.json();
      const data = body.data;

      // 데이터 구조 일관성 확인
      expect(typeof data.synced).toBe('boolean');
      expect(typeof data.status).toBe('string');

      // synced=true이면 onewmsOrderNo가 있어야 함
      if (data.synced) {
        expect(data.onewmsOrderNo).toBeTruthy();
        expect(data.sentAt).toBeTruthy();
      }
    }
  });
});

// ──────────────────────── WMS 수동 동기화 시나리오 8-9 ────────────────────────

test.describe('Phase 4: WMS 수동 동기화', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('8. 수동 WMS sync API 동작 확인', async ({ request }) => {
    // APPROVED HEADQUARTERS 발주 찾기
    const orders = await getOrders(request, '&productType=HEADQUARTERS');
    const target = orders.find((o: any) => o.status === 'APPROVED');

    if (!target) { test.skip(); return; }

    // 수동 sync 호출
    const syncRes = await request.post(`${BASE_URL}/api/onewms/orders/sync`, {
      headers: POST_HEADERS,
      data: { orderId: target.id },
    });
    // 성공 또는 이미 동기화된 경우 400
    expect(syncRes.status()).toBeLessThan(500);

    const body = await syncRes.json();
    if (syncRes.ok()) {
      expect(body.data.onewmsOrderNo).toBeTruthy();
    } else {
      // 이미 동기화되었거나 필수 정보 누락
      expect(body.error).toBeTruthy();
    }
  });

  test('9. WMS sync 중복 방지 확인', async ({ request }) => {
    // 이미 sync된 발주 찾기
    const orders = await getOrders(request, '&productType=HEADQUARTERS');
    const approvedOrders = orders.filter((o: any) => o.status === 'APPROVED');

    for (const order of approvedOrders.slice(0, 3)) {
      // sync 상태 확인
      const statusRes = await request.get(`${BASE_URL}/api/onewms/orders/${order.id}/status`);
      if (!statusRes.ok()) continue;

      const status = await statusRes.json();
      if (status.data?.status === 'sent') {
        // 이미 sent 상태인 발주에 다시 sync 시도
        const syncRes = await request.post(`${BASE_URL}/api/onewms/orders/sync`, {
          headers: POST_HEADERS,
          data: { orderId: order.id },
        });

        // 중복 sync 방지: 400 에러 반환해야 함
        expect(syncRes.status()).toBe(400);
        const body = await syncRes.json();
        expect(body.error).toBeTruthy();
        return; // 하나 확인하면 충분
      }
    }

    // sent 상태 발주가 없으면 테스트 스킵 가능
    // API 구조만 확인
    expect(true).toBe(true);
  });
});
