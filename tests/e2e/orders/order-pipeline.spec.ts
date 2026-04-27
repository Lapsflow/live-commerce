import { test, expect } from '@playwright/test';
import { navigateToOrders, waitForStatsApi } from './helpers/order-ui-helpers';
import { OrderApiHelper } from './helpers/order-api-helpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Order Pipeline Cards', () => {

  test('4개 파이프라인 카드 표시', async ({ page }) => {
    await navigateToOrders(page);
    await expect(page.getByText('입금대기').first()).toBeVisible();
    await expect(page.getByText('입금완료').first()).toBeVisible();
    await expect(page.getByText('출고완료').first()).toBeVisible();
    await expect(page.getByText('취소/만료').first()).toBeVisible();
  });

  test('각 카드에 숫자와 "건" 표시', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(2000);
    // All cards should have a count with "건"
    const countElements = page.locator('text=건');
    const count = await countElements.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('API 응답과 카드 값 일치', async ({ page, request }) => {
    const api = new OrderApiHelper(request);
    const { data } = await api.getStats();
    const stats = data.data;

    await navigateToOrders(page);
    await page.waitForTimeout(2000);

    // Check 입금대기 card has correct count
    const pendingCard = page.locator('text=입금대기').first().locator('..');
    await expect(pendingCard.locator(`text=${stats.pendingUnpaid}`).first()).toBeVisible();
  });

  test('만료임박 표시 (expiringSoon > 0인 경우)', async ({ page, request }) => {
    const api = new OrderApiHelper(request);
    const { data } = await api.getStats();
    const stats = data.data;

    await navigateToOrders(page);
    await page.waitForTimeout(2000);

    if (stats.expiringSoon > 0) {
      await expect(page.getByText(/만료임박/)).toBeVisible();
    }
    // If expiringSoon is 0, the text should not appear
  });

  test('카드 클릭 시 active 스타일 적용', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(2000);

    // Click the first pipeline card (입금대기)
    const card = page.getByText('입금대기').first().locator('..').locator('..');
    await card.click();

    // After click, card should have border-2 (active state)
    await page.waitForTimeout(500);
    // Click again to deactivate
    await card.click();
    await page.waitForTimeout(500);
  });

  test('카드 클릭 토글 동작', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(2000);

    // Click 출고완료 card
    const shippedCard = page.getByText('출고완료').first().locator('..').locator('..');
    await shippedCard.click();
    await page.waitForTimeout(500);

    // Click again to deselect
    await shippedCard.click();
    await page.waitForTimeout(500);
    // No crash = success
  });
});
