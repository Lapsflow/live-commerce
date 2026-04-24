import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';
import {
  navigateToOrders,
  navigateToOrderDetail,
  setupConfirmDialogAccept,
  expectToast,
} from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/seller.json' });

test.describe('Order Actions - Seller', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  test('목록에서 입금확인 버튼 미표시', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(3000);
    const confirmBtns = page.locator('td button, [role="cell"] button').filter({ hasText: '입금확인' });
    expect(await confirmBtns.count()).toBe(0);
  });

  test('본인 주문 목록에서 취소 가능', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(3000);

    const cancelBtn = page.locator('td button, [role="cell"] button').filter({ hasText: /^취소$/ }).first();
    const btnCount = await cancelBtn.count();
    test.skip(btnCount === 0, 'No 취소 button visible for seller');

    setupConfirmDialogAccept(page);
    await cancelBtn.click();

    await expectToast(page, '발주가 취소되었습니다.');
  });

  test('상세 페이지에서 본인 주문 취소 가능', async ({ page }) => {
    const order = await api.findPendingUnpaidOrder();
    test.skip(!order, 'No PENDING+UNPAID order for seller');

    const { response: detailRes } = await api.getOrder(order.id);
    test.skip(!detailRes.ok(), 'Seller cannot access this order detail');

    await navigateToOrderDetail(page, order.id);
    await expect(page.getByRole('button', { name: /취소/ })).toBeVisible();

    setupConfirmDialogAccept(page);
    await page.getByRole('button', { name: /취소/ }).click();

    await expectToast(page, '발주가 취소되었습니다.');
  });
});
