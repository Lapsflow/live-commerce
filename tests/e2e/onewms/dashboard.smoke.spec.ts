import { test, expect } from '@playwright/test';
import { mockOnewmsAPIs } from './helpers/mock-routes';

test.describe('ONEWMS Dashboard - Smoke Tests', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await mockOnewmsAPIs(page);
    await page.goto('/dashboard/onewms');
    await page.waitForLoadState('networkidle');
  });

  test('S1: Dashboard page loads without errors', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h1')).toContainText('ONEWMS 통합 관리');

    // Verify no error messages
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: '오류' });
    await expect(errorAlert).toBeHidden();

    // Verify description is present
    await expect(page.locator('text=주문, 재고, 배송 상태를 실시간으로')).toBeVisible();
  });

  test('S2: All stat cards are visible', async ({ page }) => {
    // Use data from stats cards grid (first section with 4 cards)
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();

    const statsCards = [
      { text: '총 동기화 주문', value: '156' },
      { text: '동기화 성공률', value: '98.1' },
      { text: '실패 주문', value: '3' },
      { text: '재고 충돌', value: '5' },
    ];

    for (const card of statsCards) {
      // Find within stats grid only to avoid other sections
      const cardLocator = statsGrid.locator(`text=${card.text}`).locator('../..');
      await expect(cardLocator).toBeVisible();
      await expect(cardLocator).toContainText(card.value);
    }
  });

  test('S3: Last sync time is displayed', async ({ page }) => {
    // Look for timestamp pattern - exact text from component
    const syncTime = page.locator('text=마지막 재고 동기화').first();
    await expect(syncTime).toBeVisible();

    // Verify it's not empty
    const text = await syncTime.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('S4: Sync control buttons are present and enabled', async ({ page }) => {
    // Find the sync controls section
    const syncControlsSection = page.locator('h2:has-text("수동 동기화")').locator('..');

    // Find the control cards within the grid (2 levels up from h3 to get border container)
    const stockSyncCard = syncControlsSection.locator('h3:has-text("재고 동기화")').locator('../..');
    const orderRetryCard = syncControlsSection.locator('h3:has-text("실패 주문 재시도")').locator('../..');

    // Find buttons within each card
    const stockSyncBtn = stockSyncCard.locator('button');
    const orderRetryBtn = orderRetryCard.locator('button');

    // Verify visible
    await expect(stockSyncBtn).toBeVisible();
    await expect(orderRetryBtn).toBeVisible();

    // Verify enabled
    await expect(stockSyncBtn).toBeEnabled();
    await expect(orderRetryBtn).toBeEnabled();
  });

  test.skip('S5: Navigation to dashboard works', async ({ page }) => {
    // TODO: Navigation not implemented yet - add nav component with link to main dashboard
    // Find dashboard link in nav
    const dashboardLink = page.locator('nav a[href*="/dashboard"]').first();
    await expect(dashboardLink).toBeVisible();

    // Click and verify navigation
    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
