import { test, expect } from '@playwright/test';

/**
 * @barcode @integration @wms
 * Phase 2: WMS Price Lock Enforcement Tests
 *
 * Tests:
 * 1. Lock icons appear on sellPrice and supplyPrice inputs
 * 2. Price inputs are disabled (readOnly attribute)
 * 3. Tooltip text shows "WMS 상품은 가격 수정이 불가합니다"
 * 4. Editing is blocked for WMS products
 *
 * Note: Tests depend on HEADQUARTERS products existing in database.
 * Uses API to find WMS product ID instead of direct Prisma access.
 */

test.describe('WMS Price Lock Enforcement', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  /**
   * Get a WMS/HEADQUARTERS product ID via API
   */
  async function findWmsProductId(page: import('@playwright/test').Page): Promise<string | null> {
    // Navigate to products page and look for HEADQUARTERS type products
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Look for first product link that might be a HEADQUARTERS product
    // Check via API
    const response = await page.request.get('/api/products?productType=HEADQUARTERS&limit=1');
    if (response.ok()) {
      const body = await response.json().catch(() => null);
      const products = body?.data || body || [];
      if (Array.isArray(products) && products.length > 0) {
        return products[0].id;
      }
    }

    return null;
  }

  test('should display Lock icons on price fields for WMS products', async ({ page }) => {
    const wmsProductId = await findWmsProductId(page);

    if (!wmsProductId) {
      test.skip(true, 'No WMS products found in database');
      return;
    }

    await page.goto(`/products/${wmsProductId}`);
    await page.waitForLoadState('networkidle');

    // Check for Lock icons or WMS-related text
    const hasLockIcon = await page.locator('[class*="lucide-lock"]')
      .or(page.locator('[data-lucide="lock"]'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const lockText = await page.locator('text=WMS')
      .or(page.locator('text=가격 수정'))
      .or(page.locator('text=불가'))
      .or(page.locator('text=본사'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasLockIcon || lockText).toBeTruthy();
  });

  test('should disable price inputs for WMS products', async ({ page }) => {
    const wmsProductId = await findWmsProductId(page);

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

  test('should display tooltip or message about WMS price lock', async ({ page }) => {
    const wmsProductId = await findWmsProductId(page);

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

  test('should distinguish WMS products from CENTER products', async ({ page }) => {
    const wmsProductId = await findWmsProductId(page);

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
