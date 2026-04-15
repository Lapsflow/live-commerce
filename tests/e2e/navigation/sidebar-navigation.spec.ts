import { test, expect } from '@playwright/test';

/**
 * @navigation @integration @sidebar
 * Phase 3: Sidebar Navigation Tests
 *
 * Tests all sidebar links to ensure they navigate without 404 errors
 * Tests role-based navigation (SELLER, ADMIN, MASTER)
 */

test.describe('Sidebar Navigation (SELLER role)', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  const sellerLinks = [
    '대시보드',
    '상품 관리',
    '주문 관리',
    '방송 관리',
    '판매 현황',
    '바코드',
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  for (const linkText of sellerLinks) {
    test(`sidebar link "${linkText}" navigates without 404`, async ({ page }) => {
      // Find and click sidebar link
      const link = page.locator(`nav a:has-text("${linkText}")`).or(
        page.locator(`aside a:has-text("${linkText}")`)
      ).first();

      const isVisible = await link.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        console.warn(`Link "${linkText}" not found in sidebar - may not be visible for SELLER`);
        test.skip(true, `Link not visible for SELLER role`);
        return;
      }

      await link.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Verify no 404
      const is404 = await page.locator('text=404')
        .or(page.locator('text=찾을 수 없습니다'))
        .or(page.locator('text=Not Found'))
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(is404).toBeFalsy();

      // Verify page loaded successfully
      const currentUrl = page.url();
      expect(currentUrl).not.toBe('about:blank');
      expect(currentUrl).not.toContain('/login');
    });
  }
});

test.describe('Sidebar Navigation (ADMIN role)', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const adminLinks = [
    '대시보드',
    '상품 관리',
    '주문 관리',
    '센터 관리',
    '사용자 관리',
    '방송 관리',
    '바코드',
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  for (const linkText of adminLinks) {
    test(`sidebar link "${linkText}" navigates without 404`, async ({ page }) => {
      const link = page.locator(`nav a:has-text("${linkText}")`).or(
        page.locator(`aside a:has-text("${linkText}")`)
      ).first();

      const isVisible = await link.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        console.warn(`Link "${linkText}" not found in sidebar - may not be visible for ADMIN`);
        test.skip(true, `Link not visible for ADMIN role`);
        return;
      }

      await link.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Verify no 404
      const is404 = await page.locator('text=404')
        .or(page.locator('text=찾을 수 없습니다'))
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(is404).toBeFalsy();
    });
  }
});

test.describe('Sidebar Navigation - Dropdown Actions', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('clicking product dropdown actions should not result in 404', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Find first product row with dropdown
    const dropdownButton = page.locator('[role="button"]:has-text("⋮")')
      .or(page.locator('button:has-text("...")')
      ).or(page.locator('[data-testid="product-actions"]'))
      .first();

    const hasDropdown = await dropdownButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasDropdown) {
      test.skip(true, 'No dropdown actions found');
      return;
    }

    await dropdownButton.click();
    await page.waitForTimeout(500);

    // Find dropdown menu items
    const menuItems = page.locator('[role="menuitem"]').or(
      page.locator('[class*="dropdown"] a')
    );

    const menuCount = await menuItems.count();

    if (menuCount === 0) {
      test.skip(true, 'No menu items found');
      return;
    }

    // Click first menu item
    const firstItem = menuItems.first();
    await firstItem.click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Verify no 404
    const is404 = await page.locator('text=404').isVisible({ timeout: 2000 }).catch(() => false);
    expect(is404).toBeFalsy();
  });
});

test.describe('Sidebar Navigation - Role-Based Visibility', () => {
  test('SELLER should not see admin-only links', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'seller-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Admin-only links should not be visible
    const adminOnlyLinks = ['센터 관리', '사용자 관리', '계약 승인'];

    for (const linkText of adminOnlyLinks) {
      const link = page.locator(`nav a:has-text("${linkText}")`).or(
        page.locator(`aside a:has-text("${linkText}")`)
      );

      const isVisible = await link.isVisible({ timeout: 2000 }).catch(() => false);

      // SELLER should NOT see these links
      expect(isVisible).toBeFalsy();
    }
  });

  test('ADMIN should see admin-only links', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'admin-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Admin-only links should be visible
    const adminOnlyLinks = ['센터 관리', '사용자 관리'];

    let visibleCount = 0;

    for (const linkText of adminOnlyLinks) {
      const link = page.locator(`nav a:has-text("${linkText}")`).or(
        page.locator(`aside a:has-text("${linkText}")`)
      );

      const isVisible = await link.isVisible({ timeout: 3000 }).catch(() => false);

      if (isVisible) {
        visibleCount++;
      }
    }

    // At least one admin link should be visible
    expect(visibleCount).toBeGreaterThan(0);
  });
});

test.describe('Sidebar Navigation - All Links Comprehensive Check', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('extract and test all sidebar links automatically', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Get all sidebar links
    const sidebarLinks = await page.locator('nav a').or(page.locator('aside a')).all();

    const results = [];

    for (const link of sidebarLinks) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();

      if (!href || href === '#' || href.startsWith('javascript:')) {
        continue;
      }

      // Click link
      await link.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Check for 404
      const is404 = await page.locator('text=404').isVisible({ timeout: 2000 }).catch(() => false);

      results.push({
        text: text?.trim() || 'Unknown',
        href,
        is404,
        finalUrl: page.url(),
      });

      // Go back to dashboard for next test
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }

    // Log all results
    console.log('\n========== ALL SIDEBAR LINKS TEST RESULTS ==========');
    results.forEach((r, index) => {
      console.log(`${index + 1}. ${r.text} (${r.href})`);
      console.log(`   Final URL: ${r.finalUrl}`);
      console.log(`   404: ${r.is404 ? '❌ YES' : '✅ NO'}`);
    });
    console.log('====================================================\n');

    // No links should result in 404
    const all404Free = results.every((r) => !r.is404);
    expect(all404Free).toBeTruthy();

    if (!all404Free) {
      const failed = results.filter((r) => r.is404);
      console.error('Links with 404 errors:', failed);
    }
  });
});
