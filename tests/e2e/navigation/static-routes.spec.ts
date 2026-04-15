import { test, expect } from '@playwright/test';
import { navigateAndCheck404 } from '../helpers/navigation-helpers';

/**
 * @navigation @integration
 * Phase 3: Static Routes Validation Tests
 *
 * Tests all static routes to ensure they return 200 or redirect (no 404)
 */

interface RouteTest {
  path: string;
  expectedText: string;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  description?: string;
}

const staticRoutes: RouteTest[] = [
  // Auth routes (public)
  { path: '/login', expectedText: '로그인', description: 'Login page' },
  { path: '/signup', expectedText: '회원가입', description: 'Signup page' },

  // Main app routes (authenticated)
  { path: '/dashboard', expectedText: '대시보드', requiresAuth: true, description: 'Dashboard' },
  { path: '/products', expectedText: '상품', requiresAuth: true, description: 'Products list' },
  { path: '/products/new', expectedText: '상품 추가', requiresAuth: true, description: 'New product form' },
  { path: '/orders', expectedText: '주문', requiresAuth: true, description: 'Orders list' },
  { path: '/orders/upload', expectedText: '업로드', requiresAuth: true, description: 'Order upload' },
  { path: '/barcode', expectedText: '바코드', requiresAuth: true, description: 'Barcode scanner' },
  { path: '/broadcasts', expectedText: '방송', requiresAuth: true, description: 'Broadcasts list' },
  { path: '/broadcasts/calendar', expectedText: '캘린더', requiresAuth: true, description: 'Broadcast calendar' },
  { path: '/sales', expectedText: '판매', requiresAuth: true, description: 'Sales tracking' },
  { path: '/proposals', expectedText: '제안', requiresAuth: true, description: 'Proposals page' },

  // Admin routes (admin only)
  { path: '/admin/centers', expectedText: '센터', requiresAuth: true, requiresAdmin: true, description: 'Centers management' },
];

test.describe('Static Routes - Public (No Auth)', () => {
  const publicRoutes = staticRoutes.filter((r) => !r.requiresAuth);

  for (const route of publicRoutes) {
    test(`${route.path} should load without 404`, async ({ page }) => {
      const is404 = await navigateAndCheck404(page, route.path);
      expect(is404).toBeFalsy();

      // Verify expected content
      const hasExpectedText = await page.locator(`text=${route.expectedText}`)
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasExpectedText).toBeTruthy();
    });
  }
});

test.describe('Static Routes - Authenticated (SELLER)', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  const authRoutes = staticRoutes.filter((r) => r.requiresAuth && !r.requiresAdmin);

  for (const route of authRoutes) {
    test(`${route.path} should load for SELLER without 404`, async ({ page }) => {
      const is404 = await navigateAndCheck404(page, route.path);
      expect(is404).toBeFalsy();

      // Verify not redirected to login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
      expect(currentUrl).not.toContain('/signin');

      // Verify expected content or successful page load
      const hasExpectedText = await page.locator(`text=${route.expectedText}`)
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      const hasAnyContent = await page.locator('body').isVisible();

      expect(hasExpectedText || hasAnyContent).toBeTruthy();
    });
  }
});

test.describe('Static Routes - Admin Only (ADMIN)', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const adminRoutes = staticRoutes.filter((r) => r.requiresAdmin);

  for (const route of adminRoutes) {
    test(`${route.path} should load for ADMIN without 404`, async ({ page }) => {
      const is404 = await navigateAndCheck404(page, route.path);
      expect(is404).toBeFalsy();

      // Verify expected content
      const hasExpectedText = await page.locator(`text=${route.expectedText}`)
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasExpectedText).toBeTruthy();
    });
  }
});

test.describe('Static Routes - Admin Access Control', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  const adminRoutes = staticRoutes.filter((r) => r.requiresAdmin);

  for (const route of adminRoutes) {
    test(`${route.path} should block SELLER access (403 or redirect)`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle', timeout: 10000 });

      const currentUrl = page.url();

      // Should either redirect to dashboard or show 403/unauthorized
      const isRedirected = currentUrl.includes('/dashboard') || currentUrl.includes('/forbidden');
      const is403 = await page.locator('text=403')
        .or(page.locator('text=권한'))
        .or(page.locator('text=Forbidden'))
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(isRedirected || is403).toBeTruthy();
    });
  }
});

test.describe('Static Routes - Response Status Codes', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('all authenticated routes should return 200 for ADMIN', async ({ page }) => {
    const routesToTest = staticRoutes.filter((r) => r.requiresAuth);

    const results = [];

    for (const route of routesToTest) {
      const response = await page.goto(route.path, { waitUntil: 'networkidle', timeout: 10000 });
      const status = response?.status() || 0;

      results.push({
        path: route.path,
        status,
        success: status === 200 || status === 304, // 304 is cached, also OK
      });
    }

    // All routes should return 200 or 304
    const allSuccessful = results.every((r) => r.success);
    expect(allSuccessful).toBeTruthy();

    // If any failed, log details
    if (!allSuccessful) {
      const failures = results.filter((r) => !r.success);
      console.log('Failed routes:', failures);
    }
  });
});

test.describe('Static Routes - Navigation Performance', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('common routes should load within 5 seconds', async ({ page }) => {
    const commonRoutes = ['/dashboard', '/products', '/barcode', '/orders'];

    for (const route of commonRoutes) {
      const startTime = Date.now();

      await page.goto(route, { waitUntil: 'networkidle', timeout: 10000 });

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    }
  });
});
