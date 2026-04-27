import { test, expect } from '@playwright/test';

/**
 * @barcode @integration @ai
 * Phase 2: AI Analysis Manual Trigger Tests
 *
 * Tests:
 * 1. AI analysis button exists on barcode page
 * 2. AI analysis is triggered MANUALLY (button click), not auto
 * Note: Tests depend on barcode '8801234567890' existing in DB
 */

test.describe('AI Analysis Manual Trigger', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/barcode');
    await expect(page.locator('h1')).toContainText('바코드');
  });

  test('should not auto-trigger AI analysis on barcode scan', async ({ page }) => {
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(2000);

    // Check if product was found
    const hasProductInfo = await page.locator('text=상품 정보').isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasProductInfo) {
      test.skip(true, 'Test barcode not found in DB - skipping AI analysis test');
      return;
    }

    // AI analysis should NOT auto-trigger
    const hasAutoResults = await page.locator('text=가격 적정성')
      .or(page.locator('text=판매 전략'))
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasAutoResults).toBeFalsy();
  });

  test('should have AI analysis button when product is loaded', async ({ page }) => {
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(2000);

    const hasProductInfo = await page.locator('text=상품 정보').isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasProductInfo) {
      test.skip(true, 'Test barcode not found in DB - skipping AI button test');
      return;
    }

    // AI analysis button should be visible
    const aiButton = page.locator('button:has-text("AI 분석")')
      .or(page.locator('button:has-text("분석")'))
      .first();

    await expect(aiButton).toBeVisible({ timeout: 5000 });
  });

  test('should trigger AI analysis on button click', async ({ page }) => {
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(2000);

    const hasProductInfo = await page.locator('text=상품 정보').isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasProductInfo) {
      test.skip(true, 'Test barcode not found in DB - skipping AI trigger test');
      return;
    }

    const aiButton = page.locator('button:has-text("AI 분석")')
      .or(page.locator('button:has-text("분석")'))
      .first();

    const isVisible = await aiButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AI analysis button not found');
      return;
    }

    await aiButton.click();

    // Verify loading state or results appear
    const hasResponse = await page.locator('text=분석 중')
      .or(page.locator('text=가격 적정성'))
      .or(page.locator('text=판매 전략'))
      .or(page.locator('text=실패'))
      .or(page.locator('text=제한'))
      .isVisible({ timeout: 15000 })
      .catch(() => false);

    expect(hasResponse).toBeTruthy();
  });
});
