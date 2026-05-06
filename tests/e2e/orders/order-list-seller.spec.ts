import { test, expect } from '@playwright/test';
import { navigateToOrders } from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/seller.json' });

test.describe('Order List Page - Seller', () => {

  test('페이지 제목 "내 발주" 표시', async ({ page }) => {
    await navigateToOrders(page);
    await expect(page.getByRole('heading', { name: '내 발주' })).toBeVisible();
  });

  test('주문 목록 또는 빈 상태 표시', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(3000);
    // Page should load without errors
    await expect(page.locator('body')).not.toContainText('오류');
  });

  test('입금확인 버튼이 표시되지 않음 (SELLER 역할)', async ({ page }) => {
    await navigateToOrders(page);
    await page.waitForTimeout(3000);
    // Seller is not admin, so 입금확인 button should not appear in action column
    const confirmBtns = page.locator('td button, [role="cell"] button').filter({ hasText: '입금확인' });
    expect(await confirmBtns.count()).toBe(0);
  });

  test('엑셀 업로드, 신규 발주 버튼 표시', async ({ page }) => {
    await navigateToOrders(page);
    await expect(page.getByText('엑셀 업로드')).toBeVisible();
    await expect(page.getByText('신규 발주')).toBeVisible();
  });
});
