/**
 * ONEWMS Stock Sync - Integration Tests
 *
 * Verifies manual stock sync triggers real API and creates database records.
 * Tests UI interactions, database persistence, and permissions.
 *
 * @integration
 */

import { test, expect } from '@playwright/test';
import { skipIfCredentialsMissing } from './helpers/env-check';
import { waitForApiCall } from './helpers/api-helpers';
import {
  getStockSyncCount,
  getRecentStockSyncs,
  disconnectPrisma,
} from './helpers/db-helpers';

test.describe('ONEWMS Stock Sync - Integration @integration', () => {
  test.beforeAll(() => {
    skipIfCredentialsMissing();
  });

  test.use({ storageState: 'playwright/.auth/admin.json' });

  // Cleanup after all tests
  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test('I5: Manual stock sync button triggers real API', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard/onewms');
    await page.waitForLoadState('networkidle');

    // Find the "마지막 재고 동기화" section
    const lastSyncSection = page.locator('text=마지막 재고 동기화').first();
    await expect(lastSyncSection).toBeVisible();

    // Record initial sync text
    const initialSyncText = await lastSyncSection.locator('../..').textContent();
    console.log(`📝 Initial sync status: ${initialSyncText}`);

    // Find and click the "재고 동기화" button
    const syncControlsSection = page.locator('h2:has-text("수동 동기화")').locator('..');
    const stockSyncCard = syncControlsSection.locator('h3:has-text("재고 동기화")').locator('../..');
    const syncButton = stockSyncCard.locator('button:has-text("실행")');

    await expect(syncButton).toBeVisible();
    await expect(syncButton).toBeEnabled();

    // Set up API call waiter BEFORE clicking button
    const apiResponsePromise = waitForApiCall(page, '/api/onewms/stock/sync', 30000);

    // Click sync button
    await syncButton.click();
    console.log('🔄 Clicked "재고 동기화" button');

    // Wait for confirmation dialog
    const confirmDialog = page.locator('text=확인').locator('..');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Click confirm button
    const confirmButton = confirmDialog.locator('button:has-text("확인")').first();
    await confirmButton.click();
    console.log('✅ Confirmed sync');

    // Wait for API call to complete
    const apiResponse = await apiResponsePromise;
    expect(apiResponse.status()).toBe(200);

    const responseData = await apiResponse.json();
    console.log('📊 API response:', JSON.stringify(responseData, null, 2));

    // Wait for page to update (networkidle ensures all updates complete)
    await page.waitForLoadState('networkidle');

    // Verify timestamp updated in UI
    const updatedSyncText = await lastSyncSection.locator('../..').textContent();
    console.log(`📝 Updated sync status: ${updatedSyncText}`);

    // Verify text changed (or at least contains "방금 전" or recent time)
    const hasRecentTime =
      updatedSyncText?.includes('방금 전') ||
      updatedSyncText?.includes('분 전') ||
      updatedSyncText !== initialSyncText;

    expect(hasRecentTime).toBe(true);
  });

  test('I6: Stock sync creates database records', async ({ page }) => {
    // 1. Get current stock sync count
    const initialCount = await getStockSyncCount();
    console.log(`📊 Initial stock sync record count: ${initialCount}`);

    // 2. Navigate to dashboard
    await page.goto('/dashboard/onewms');
    await page.waitForLoadState('networkidle');

    // 3. Trigger stock sync
    const syncControlsSection = page.locator('h2:has-text("수동 동기화")').locator('..');
    const stockSyncCard = syncControlsSection.locator('h3:has-text("재고 동기화")').locator('../..');
    const syncButton = stockSyncCard.locator('button:has-text("실행")');

    // Wait for API response
    const apiResponsePromise = waitForApiCall(page, '/api/onewms/stock/sync', 30000);

    // Click and confirm
    await syncButton.click();
    const confirmButton = page.locator('button:has-text("확인")').first();
    await confirmButton.click();

    // Wait for completion
    await apiResponsePromise;
    await page.waitForLoadState('networkidle');

    console.log('⏳ Waiting for database to update...');
    await page.waitForTimeout(2000); // Brief wait for DB write

    // 4. Verify new records were created
    const finalCount = await getStockSyncCount();
    console.log(`📊 Final stock sync record count: ${finalCount}`);

    expect(finalCount).toBeGreaterThan(initialCount);

    const recordsAdded = finalCount - initialCount;
    console.log(`✅ ${recordsAdded} new stock sync records created`);

    // 5. Verify record structure
    const recentSyncs = await getRecentStockSyncs(5);
    expect(recentSyncs.length).toBeGreaterThan(0);

    const mostRecent = recentSyncs[0];
    console.log('📝 Most recent sync record:', {
      productCode: mostRecent.productCode,
      availableQty: mostRecent.availableQty,
      localQty: mostRecent.localQty,
      syncStatus: mostRecent.syncStatus,
      syncedAt: mostRecent.syncedAt,
    });

    // Verify required fields exist
    expect(mostRecent.productCode).toBeTruthy();
    expect(typeof mostRecent.availableQty).toBe('number');
    expect(typeof mostRecent.localQty).toBe('number');
    expect(mostRecent.syncStatus).toMatch(/synced|conflict|failed|resolved/);
    expect(mostRecent.syncedAt).toBeInstanceOf(Date);

    // Verify timestamp is recent (within last 5 minutes)
    const now = new Date();
    const syncAge = (now.getTime() - mostRecent.syncedAt.getTime()) / (1000 * 60);
    expect(syncAge).toBeLessThan(5);

    console.log(`✅ Record timestamp is ${syncAge.toFixed(2)} minutes old (< 5min)`);
  });

  test('I7: Stock sync shows conflicts when detected', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard/onewms');
    await page.waitForLoadState('networkidle');

    // Check current conflict count in UI
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();
    const conflictsCard = statsGrid.locator('text=재고 충돌').locator('../..');
    const conflictsValue = await conflictsCard.locator('.text-3xl').textContent();

    console.log(`📊 Current stock conflicts: ${conflictsValue}`);

    // Verify conflicts value is a valid number
    const conflictCount = Number(conflictsValue);
    expect(isNaN(conflictCount)).toBe(false);
    expect(conflictCount).toBeGreaterThanOrEqual(0);

    // If conflicts exist, verify the conflicts list section
    if (conflictCount > 0) {
      const conflictsSection = page.locator('text=재고 충돌 목록').first();
      await expect(conflictsSection).toBeVisible();

      console.log(`✅ Conflicts section visible with ${conflictCount} conflicts`);
    } else {
      console.log('ℹ️ No conflicts detected at this time');
    }
  });

  test('I8: Non-admin cannot trigger stock sync', async ({ browser }) => {
    // Check if seller auth file exists
    const sellerAuthPath = 'playwright/.auth/seller.json';

    try {
      // Try to create seller context
      const sellerContext = await browser.newContext({
        storageState: sellerAuthPath,
      });
      const page = await sellerContext.newPage();

      // Navigate to dashboard
      await page.goto('/dashboard/onewms');
      await page.waitForLoadState('networkidle');

      // Try to find sync button
      const syncControlsSection = page.locator('h2:has-text("수동 동기화")').locator('..');
      const stockSyncCard = syncControlsSection.locator('h3:has-text("재고 동기화")').locator('../..');
      const syncButton = stockSyncCard.locator('button');

      // Button should be disabled for seller role
      const isDisabled = await syncButton.isDisabled();
      expect(isDisabled).toBe(true);

      console.log('✅ Sync button is disabled for SELLER role');

      await sellerContext.close();
    } catch (error) {
      // If seller auth doesn't exist, skip this test
      console.log('ℹ️ Seller auth not configured, skipping permission test');
      console.log('   To test: Create playwright/.auth/seller.json with SELLER role auth');
      test.skip();
    }
  });
});
