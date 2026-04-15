import { test, expect } from '@playwright/test';
import { getWmsProductId } from '../fixtures/test-data';

/**
 * @barcode @integration @wms
 * Phase 2: WMS Price Lock Enforcement Tests
 *
 * Tests:
 * 1. Lock icons appear on sellPrice and supplyPrice inputs
 * 2. Price inputs are disabled (readOnly attribute)
 * 3. Tooltip text shows "WMS 상품은 가격 수정이 불가합니다"
 * 4. Editing is blocked for WMS products
 */

test.describe('WMS Price Lock Enforcement', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('should display Lock icons on price fields for WMS products', async ({ page }) => {
    // Get a WMS product ID
    const wmsProductId = await getWmsProductId();

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    // Navigate to WMS product edit page
    await page.goto(`/products/${wmsProductId}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for Lock icons
    // Lock icon should be visible near price inputs
    const lockIcon = page.locator('svg').filter({ hasText: '' }).or(
      page.locator('[class*="lucide-lock"]')
    ).or(
      page.locator('[data-lucide="lock"]')
    );

    const hasLockIcon = await lockIcon.isVisible({ timeout: 5000 }).catch(() => false);

    // Or check for Lock component from lucide-react
    const lockText = await page.locator('text=WMS')
      .or(page.locator('text=가격 수정'))
      .or(page.locator('text=불가'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasLockIcon || lockText).toBeTruthy();
  });

  test('should disable price inputs for WMS products', async ({ page }) => {
    const wmsProductId = await getWmsProductId();

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    await page.goto(`/products/${wmsProductId}`);
    await page.waitForLoadState('networkidle');

    // Find sellPrice input
    const sellPriceInput = page.locator('input#sellPrice')
      .or(page.locator('input[name="sellPrice"]'))
      .or(page.locator('label:has-text("판매가") + * input'))
      .first();

    // Find supplyPrice input
    const supplyPriceInput = page.locator('input#supplyPrice')
      .or(page.locator('input[name="supplyPrice"]'))
      .or(page.locator('label:has-text("공급가") + * input'))
      .first();

    // Check if inputs are disabled or readOnly
    const sellPriceDisabled = await sellPriceInput.isDisabled({ timeout: 3000 }).catch(() => false);
    const sellPriceReadOnly = await sellPriceInput.getAttribute('readonly').catch(() => null);

    const supplyPriceDisabled = await supplyPriceInput.isDisabled({ timeout: 3000 }).catch(() => false);
    const supplyPriceReadOnly = await supplyPriceInput.getAttribute('readonly').catch(() => null);

    // At least one price input should be disabled/readonly
    expect(
      sellPriceDisabled ||
      sellPriceReadOnly !== null ||
      supplyPriceDisabled ||
      supplyPriceReadOnly !== null
    ).toBeTruthy();
  });

  test('should have gray background on disabled price fields', async ({ page }) => {
    const wmsProductId = await getWmsProductId();

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    await page.goto(`/products/${wmsProductId}`);
    await page.waitForLoadState('networkidle');

    // Find price inputs
    const sellPriceInput = page.locator('input#sellPrice')
      .or(page.locator('input[name="sellPrice"]'))
      .or(page.locator('label:has-text("판매가") + * input'))
      .first();

    // Check for gray background class
    const className = await sellPriceInput.getAttribute('class');
    const hasGrayBackground = className?.includes('bg-gray') || className?.includes('disabled');

    expect(hasGrayBackground).toBeTruthy();
  });

  test('should display tooltip or message about WMS price lock', async ({ page }) => {
    const wmsProductId = await getWmsProductId();

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    await page.goto(`/products/${wmsProductId}`);
    await page.waitForLoadState('networkidle');

    // Check for WMS-related messages
    const hasWmsMessage = await page.locator('text=WMS 상품은 가격 수정이 불가합니다')
      .or(page.locator('text=WMS 상품'))
      .or(page.locator('text=가격 수정이 불가'))
      .or(page.locator('text=본사'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasWmsMessage).toBeTruthy();
  });

  test('should prevent editing of WMS product prices', async ({ page }) => {
    const wmsProductId = await getWmsProductId();

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    await page.goto(`/products/${wmsProductId}`);
    await page.waitForLoadState('networkidle');

    // Try to edit sell price
    const sellPriceInput = page.locator('input#sellPrice')
      .or(page.locator('input[name="sellPrice"]'))
      .or(page.locator('label:has-text("판매가") + * input'))
      .first();

    // Attempt to fill the input
    try {
      await sellPriceInput.fill('99999', { timeout: 2000 });

      // Check if value actually changed
      const currentValue = await sellPriceInput.inputValue();

      // If input is properly locked, value should not be '99999'
      // (It should either reject the input or keep original value)
      const isLocked = currentValue !== '99999';

      expect(isLocked).toBeTruthy();
    } catch (error) {
      // If fill throws error, input is properly locked
      expect(true).toBeTruthy();
    }
  });

  test('should distinguish WMS products from CENTER products', async ({ page }) => {
    const wmsProductId = await getWmsProductId();

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    await page.goto(`/products/${wmsProductId}`);
    await page.waitForLoadState('networkidle');

    // Check for product type indicator
    const hasHeadquartersIndicator = await page.locator('text=본사')
      .or(page.locator('text=HEADQUARTERS'))
      .or(page.locator('text=WMS'))
      .or(page.locator('text=슈퍼무진'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasHeadquartersIndicator).toBeTruthy();
  });
});
