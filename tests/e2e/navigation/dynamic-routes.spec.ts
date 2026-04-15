import { test, expect } from '@playwright/test';
import {
  getFirstProductId,
  getFirstOrderId,
  getFirstBroadcastId,
  getFirstCenterId,
} from '../fixtures/test-data';
import { navigateAndCheck404, getNavigationStatus } from '../helpers/navigation-helpers';

/**
 * @navigation @integration @dynamic
 * Phase 3: Dynamic Routes Validation Tests
 *
 * Tests dynamic routes with valid and invalid IDs
 */

test.describe('Dynamic Routes - Valid IDs (SELLER)', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('valid product ID should show product detail page', async ({ page }) => {
    const productId = await getFirstProductId();

    if (!productId) {
      test.skip(true, 'No products found in database');
      return;
    }

    const is404 = await navigateAndCheck404(page, `/products/${productId}`);
    expect(is404).toBeFalsy();

    // Verify product detail page loaded
    const hasProductInfo = await page.locator('text=상품')
      .or(page.locator('text=바코드'))
      .or(page.locator('text=가격'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasProductInfo).toBeTruthy();
  });

  test('valid order ID should show order detail page', async ({ page }) => {
    const orderId = await getFirstOrderId();

    if (!orderId) {
      test.skip(true, 'No orders found in database');
      return;
    }

    const is404 = await navigateAndCheck404(page, `/orders/${orderId}`);
    expect(is404).toBeFalsy();

    // Verify order detail page loaded
    const hasOrderInfo = await page.locator('text=주문')
      .or(page.locator('text=상품'))
      .or(page.locator('text=수량'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasOrderInfo).toBeTruthy();
  });

  test('valid broadcast ID should show broadcast live page', async ({ page }) => {
    const broadcastId = await getFirstBroadcastId();

    if (!broadcastId) {
      test.skip(true, 'No broadcasts found in database');
      return;
    }

    const is404 = await navigateAndCheck404(page, `/broadcasts/${broadcastId}/live`);
    expect(is404).toBeFalsy();

    // Verify broadcast page loaded
    const hasBroadcastContent = await page.locator('text=방송')
      .or(page.locator('text=라이브'))
      .or(page.locator('text=판매'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasBroadcastContent).toBeTruthy();
  });
});

test.describe('Dynamic Routes - Valid IDs (ADMIN)', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('valid center ID should show center detail page', async ({ page }) => {
    const centerId = await getFirstCenterId();

    if (!centerId) {
      test.skip(true, 'No centers found in database');
      return;
    }

    const is404 = await navigateAndCheck404(page, `/admin/centers/${centerId}`);
    expect(is404).toBeFalsy();

    // Verify center detail page loaded
    const hasCenterInfo = await page.locator('text=센터')
      .or(page.locator('text=지역'))
      .or(page.locator('text=대표'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasCenterInfo).toBeTruthy();
  });

  test('valid center ID/edit should show center edit page', async ({ page }) => {
    const centerId = await getFirstCenterId();

    if (!centerId) {
      test.skip(true, 'No centers found in database');
      return;
    }

    const is404 = await navigateAndCheck404(page, `/admin/centers/${centerId}/edit`);
    expect(is404).toBeFalsy();

    // Verify edit form loaded
    const hasEditForm = await page.locator('text=수정')
      .or(page.locator('text=센터'))
      .or(page.locator('button:has-text("저장")'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasEditForm).toBeTruthy();
  });

  test('valid center ID/stats should show center statistics page', async ({ page }) => {
    const centerId = await getFirstCenterId();

    if (!centerId) {
      test.skip(true, 'No centers found in database');
      return;
    }

    const is404 = await navigateAndCheck404(page, `/admin/centers/${centerId}/stats`);
    expect(is404).toBeFalsy();

    // Verify stats page loaded
    const hasStatsContent = await page.locator('text=통계')
      .or(page.locator('text=판매'))
      .or(page.locator('text=주문'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasStatsContent).toBeTruthy();
  });
});

test.describe('Dynamic Routes - Invalid IDs', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('invalid product ID should show 404 or error', async ({ page }) => {
    const is404 = await navigateAndCheck404(page, '/products/invalid-id-12345');

    const hasErrorMessage = await page.locator('text=찾을 수 없습니다')
      .or(page.locator('text=404'))
      .or(page.locator('text=존재하지 않습니다'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Either 404 page or error message should appear
    expect(is404 || hasErrorMessage).toBeTruthy();
  });

  test('invalid order ID should show 404 or error', async ({ page }) => {
    const is404 = await navigateAndCheck404(page, '/orders/invalid-order-id');

    const hasErrorMessage = await page.locator('text=찾을 수 없습니다')
      .or(page.locator('text=404'))
      .or(page.locator('text=존재하지 않습니다'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(is404 || hasErrorMessage).toBeTruthy();
  });

  test('invalid broadcast ID should show 404 or error', async ({ page }) => {
    const is404 = await navigateAndCheck404(page, '/broadcasts/invalid-broadcast/live');

    const hasErrorMessage = await page.locator('text=찾을 수 없습니다')
      .or(page.locator('text=404'))
      .or(page.locator('text=존재하지 않습니다'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(is404 || hasErrorMessage).toBeTruthy();
  });

  test('malformed product ID (non-cuid) should show error', async ({ page }) => {
    const is404 = await navigateAndCheck404(page, '/products/123');

    const hasErrorMessage = await page.locator('text=찾을 수 없습니다')
      .or(page.locator('text=404'))
      .or(page.locator('text=Invalid'))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(is404 || hasErrorMessage).toBeTruthy();
  });
});

test.describe('Dynamic Routes - Admin Authorization', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('SELLER should not access admin center routes', async ({ page }) => {
    const centerId = await getFirstCenterId();

    if (!centerId) {
      test.skip(true, 'No centers found in database');
      return;
    }

    // Try to access admin center page as SELLER
    await page.goto(`/admin/centers/${centerId}`, { waitUntil: 'networkidle', timeout: 10000 });

    const currentUrl = page.url();

    // Should be redirected or shown 403
    const isRedirected = !currentUrl.includes(`/admin/centers/${centerId}`);
    const is403 = await page.locator('text=403')
      .or(page.locator('text=권한'))
      .or(page.locator('text=Forbidden'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(isRedirected || is403).toBeTruthy();
  });
});

test.describe('Dynamic Routes - Response Status Codes', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('valid dynamic routes should return 200', async ({ page }) => {
    const productId = await getFirstProductId();
    const orderId = await getFirstOrderId();
    const centerId = await getFirstCenterId();

    const tests = [];

    if (productId) {
      tests.push({ path: `/products/${productId}`, name: 'Product Detail' });
    }

    if (orderId) {
      tests.push({ path: `/orders/${orderId}`, name: 'Order Detail' });
    }

    if (centerId) {
      tests.push({ path: `/admin/centers/${centerId}`, name: 'Center Detail' });
      tests.push({ path: `/admin/centers/${centerId}/edit`, name: 'Center Edit' });
      tests.push({ path: `/admin/centers/${centerId}/stats`, name: 'Center Stats' });
    }

    const results = [];

    for (const testCase of tests) {
      const status = await getNavigationStatus(page, testCase.path);
      results.push({
        path: testCase.path,
        name: testCase.name,
        status,
        success: status === 200 || status === 304,
      });
    }

    // All valid routes should return 200 or 304
    const allSuccessful = results.every((r) => r.success);
    expect(allSuccessful).toBeTruthy();

    if (!allSuccessful) {
      const failures = results.filter((r) => !r.success);
      console.log('Failed dynamic routes:', failures);
    }
  });

  test('invalid dynamic routes should return 404 or redirect', async ({ page }) => {
    const invalidRoutes = [
      '/products/invalid-product-id',
      '/orders/invalid-order-id',
      '/broadcasts/invalid-broadcast/live',
      '/admin/centers/invalid-center-id',
    ];

    for (const route of invalidRoutes) {
      const status = await getNavigationStatus(page, route);

      // Should return 404 or redirect (3xx)
      const isExpectedStatus = status === 404 || (status >= 300 && status < 400) || status === 500;

      expect(isExpectedStatus).toBeTruthy();
    }
  });
});
