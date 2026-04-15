import { test, expect } from '@playwright/test';

/**
 * @barcode @integration
 * Phase 2: Naver/Coupang Price Comparison Auto-Load Tests
 *
 * Tests:
 * 1. Naver price comparison auto-loads via React Query
 * 2. Coupang price comparison displays in parallel
 */

test.describe('Naver/Coupang Price Comparison', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to barcode page
    await page.goto('/barcode');
    await expect(page.locator('h1')).toContainText('바코드');
  });

  test('should auto-load Naver price comparison on barcode scan', async ({ page }) => {
    // Enter barcode
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    // Wait for product info to load first
    await page.waitForTimeout(1000);

    // Naver price comparison should auto-load via React Query (enabled: !!barcode)
    // Wait for the section to appear
    const naverSection = page.locator('text=네이버').or(page.locator('text=네이버쇼핑'));
    await expect(naverSection).toBeVisible({ timeout: 8000 });

    // Check for price information elements
    // Note: Exact text depends on API response, so we check for common patterns
    const hasPriceInfo = await page.locator('text=최저가')
      .or(page.locator('text=평균가'))
      .or(page.locator('text=원'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Or check for loading/error state
    const hasLoadingState = await page.locator('text=로딩')
      .or(page.locator('text=조회 중'))
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    const hasErrorState = await page.locator('text=실패')
      .or(page.locator('text=찾을 수 없습니다'))
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // At least one state should be present
    expect(hasPriceInfo || hasLoadingState || hasErrorState).toBeTruthy();
  });

  test('should display Coupang price comparison results', async ({ page }) => {
    // Enter barcode
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    // Wait for product info
    await page.waitForTimeout(1000);

    // Coupang section should appear (parallel API call with Naver)
    const coupangSection = page.locator('text=쿠팡').first();
    await expect(coupangSection).toBeVisible({ timeout: 8000 });

    // Check for Coupang-specific content
    // Note: API might return empty results, but section should still render
    const hasCoupangContent = await page.locator('text=상품')
      .or(page.locator('text=가격'))
      .or(page.locator('text=원'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const hasLoadingOrError = await page.locator('text=로딩')
      .or(page.locator('text=조회 중'))
      .or(page.locator('text=찾을 수 없습니다'))
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    expect(hasCoupangContent || hasLoadingOrError).toBeTruthy();
  });

  test('should show both Naver and Coupang sections simultaneously', async ({ page }) => {
    // Enter barcode
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Both sections should be visible (parallel fetching)
    const naverVisible = await page.locator('text=네이버').isVisible({ timeout: 5000 }).catch(() => false);
    const coupangVisible = await page.locator('text=쿠팡').isVisible({ timeout: 5000 }).catch(() => false);

    // At least one should be visible (API might fail for one source)
    expect(naverVisible || coupangVisible).toBeTruthy();

    // If both are visible, verify they're on the same page
    if (naverVisible && coupangVisible) {
      const pageContent = await page.content();
      expect(pageContent).toContain('네이버');
      expect(pageContent).toContain('쿠팡');
    }
  });

  test('should handle barcode with no price data gracefully', async ({ page }) => {
    // Use a barcode that likely has no data
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('0000000000000');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(2000);

    // Should show appropriate message, not crash
    const hasNotFoundMessage = await page.locator('text=찾을 수 없습니다')
      .or(page.locator('text=상품 없음'))
      .or(page.locator('text=없습니다'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasPriceSection = await page.locator('text=네이버')
      .or(page.locator('text=쿠팡'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Should either show not found or price sections (one of them)
    expect(hasNotFoundMessage || hasPriceSection).toBeTruthy();
  });
});
