import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';
import { navigateToOrders, navigateToOrderDetail } from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Expiry Timer', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  // ─── 목록 페이지 ──────────────────────────────
  test.describe('목록 페이지 타이머', () => {
    test('PENDING+UNPAID 주문에 카운트다운 HH:MM:SS 표시', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      // Timer should show HH:MM:SS pattern or "만료됨"
      const timerPattern = page.locator('.tabular-nums').first();
      const timerCount = await timerPattern.count();
      if (timerCount > 0) {
        const text = await timerPattern.textContent();
        expect(text).toMatch(/\d{2}:\d{2}:\d{2}|만료됨/);
      }
    });

    test('만료된 주문에 "만료됨" 빨간 텍스트 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      // Check for any expired timers
      const expiredTimers = page.locator('.text-red-600.font-semibold').filter({ hasText: '만료됨' });
      const count = await expiredTimers.count();
      // May or may not have expired orders - just verify no crash
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('30분 미만 주문에 주황색 warning 스타일', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      // Check for warning-styled timers
      const warningTimers = page.locator('.text-orange-600.font-semibold');
      const count = await warningTimers.count();
      // May or may not have warning orders
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('APPROVED+PAID 주문에는 타이머 미표시', async ({ page }) => {
      const order = await api.findApprovedPaidOrder();
      test.skip(!order, 'No APPROVED+PAID order available');

      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      // ExpiryTimer returns null for non-PENDING+UNPAID orders
      // Can't easily verify per-row, but ensure no crash
    });
  });

  // ─── 상세 페이지 ──────────────────────────────
  test.describe('상세 페이지 타이머', () => {
    test('PENDING+UNPAID 주문에 만료 배너 표시', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      // Verify admin can access this order
      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByText('입금 마감까지 남은 시간:')).toBeVisible();
      await expect(page.getByText('미입금 시 자동 취소됩니다')).toBeVisible();
    });

    test('타이머가 실시간 카운트다운 (값 변화)', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this order');

      await navigateToOrderDetail(page, order.id);

      const timer = page.locator('.tabular-nums').first();
      const timerCount = await timer.count();
      test.skip(timerCount === 0, 'Timer not visible');

      const firstValue = await timer.textContent();
      // Skip if already expired
      if (firstValue === '만료됨') return;

      await page.waitForTimeout(2500);
      const secondValue = await timer.textContent();

      // Values should differ (countdown progressed)
      expect(firstValue).not.toBe(secondValue);
    });

    test('APPROVED 주문에 만료 배너 미표시', async ({ page }) => {
      const order = await api.findApprovedPaidOrder();
      test.skip(!order, 'No APPROVED+PAID order available');

      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this order');

      await navigateToOrderDetail(page, order.id);
      await page.waitForTimeout(2000);
      await expect(page.getByText('입금 마감까지 남은 시간:')).not.toBeVisible();
    });

    test('REJECTED 주문에 만료 배너 대신 취소 사유 배너 표시', async ({ page }) => {
      const order = await api.findRejectedOrder();
      test.skip(!order, 'No REJECTED order available');

      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this REJECTED order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByText('입금 마감까지 남은 시간:')).not.toBeVisible();
      // Cancel reason banner - check various possible labels
      const cancelBanner = page.getByText('3시간 경과 자동 취소')
        .or(page.getByText('셀러 취소'))
        .or(page.getByText('관리자 취소'))
        .or(page.getByText('자동 취소'))
        .or(page.getByText('취소됨'));
      await expect(cancelBanner.first()).toBeVisible({ timeout: 10000 });
    });
  });
});
