import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';
import {
  navigateToOrders,
  navigateToOrderDetail,
  setupConfirmDialogAccept,
  setupConfirmDialogDismiss,
  expectToast,
} from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Order Actions - Admin', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  // ─── 입금확인 플로우 (목록) ────────────────────
  test.describe('입금확인 - 목록 페이지', () => {
    test('입금확인 다이얼로그 dismiss 시 API 미호출', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      const confirmBtn = page.locator('td button, [role="cell"] button').filter({ hasText: '입금확인' }).first();
      const btnCount = await confirmBtn.count();
      test.skip(btnCount === 0, 'No 입금확인 button visible');

      let apiCalled = false;
      page.on('request', (req) => {
        if (req.url().includes('/confirm-payment') && req.method() === 'POST') {
          apiCalled = true;
        }
      });

      setupConfirmDialogDismiss(page);
      await confirmBtn.click();
      await page.waitForTimeout(1000);
      expect(apiCalled).toBe(false);
    });

    test('입금확인 수락 시 성공 토스트 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      const confirmBtn = page.locator('td button, [role="cell"] button').filter({ hasText: '입금확인' }).first();
      const btnCount = await confirmBtn.count();
      test.skip(btnCount === 0, 'No 입금확인 button visible');

      setupConfirmDialogAccept(page);
      await confirmBtn.click();

      await expectToast(page, '입금이 확인되었습니다.');
    });
  });

  // ─── 취소 플로우 (목록) ────────────────────────
  test.describe('취소 - 목록 페이지', () => {
    test('취소 다이얼로그 dismiss 시 API 미호출', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      const cancelBtn = page.locator('td button, [role="cell"] button').filter({ hasText: /^취소$/ }).first();
      const btnCount = await cancelBtn.count();
      test.skip(btnCount === 0, 'No 취소 button visible');

      let apiCalled = false;
      page.on('request', (req) => {
        if (req.url().includes('/cancel') && req.method() === 'POST') {
          apiCalled = true;
        }
      });

      setupConfirmDialogDismiss(page);
      await cancelBtn.click();
      await page.waitForTimeout(1000);
      expect(apiCalled).toBe(false);
    });

    test('취소 수락 시 성공 토스트 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);

      const cancelBtn = page.locator('td button, [role="cell"] button').filter({ hasText: /^취소$/ }).first();
      const btnCount = await cancelBtn.count();
      test.skip(btnCount === 0, 'No 취소 button visible');

      setupConfirmDialogAccept(page);
      await cancelBtn.click();

      await expectToast(page, '발주가 취소되었습니다.');
    });
  });

  // ─── 입금확인 플로우 (상세) ────────────────────
  test.describe('입금확인 - 상세 페이지', () => {
    test('상세 페이지에서 입금확인 성공 시 상태 변경', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      const { response: detailRes } = await api.getOrder(order.id);
      test.skip(!detailRes.ok(), 'Admin cannot access this order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByRole('button', { name: /입금확인/ })).toBeVisible();

      setupConfirmDialogAccept(page);
      await page.getByRole('button', { name: /입금확인/ }).click();

      await expectToast(page, '입금이 확인되었습니다.');

      // After confirmation, status should update
      await page.waitForTimeout(2000);
      // 입금확인 button should disappear
      const confirmBtnAfter = page.getByRole('button', { name: /입금확인/ });
      expect(await confirmBtnAfter.count()).toBe(0);
    });
  });

  // ─── 취소 플로우 (상세) ────────────────────────
  test.describe('취소 - 상세 페이지', () => {
    test('상세 페이지에서 취소 성공 시 취소 사유 배너 표시', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      const { response: detailRes } = await api.getOrder(order.id);
      test.skip(!detailRes.ok(), 'Admin cannot access this order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByRole('button', { name: /취소/ })).toBeVisible();

      setupConfirmDialogAccept(page);
      await page.getByRole('button', { name: /취소/ }).click();

      await expectToast(page, '발주가 취소되었습니다.');

      // After cancel, page should refresh and show cancel reason banner
      await page.waitForTimeout(2000);
      await expect(page.getByText('관리자 취소')).toBeVisible();
    });

    test('취소 후 액션 버튼 사라짐', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      const { response: detailRes } = await api.getOrder(order.id);
      test.skip(!detailRes.ok(), 'Admin cannot access this order');

      await navigateToOrderDetail(page, order.id);

      setupConfirmDialogAccept(page);
      await page.getByRole('button', { name: /취소/ }).click();
      await page.waitForTimeout(2000);

      // Both buttons should disappear after cancellation
      expect(await page.getByRole('button', { name: /입금확인/ }).count()).toBe(0);
      expect(await page.getByRole('button', { name: /취소/ }).count()).toBe(0);
    });
  });
});
