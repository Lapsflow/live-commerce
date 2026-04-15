import { test, expect } from '@playwright/test';
import { getNavigationStatus } from '../helpers/navigation-helpers';

/**
 * @navigation @investigation
 * Phase 3: High-Risk Routes Investigation
 *
 * Investigates routes that are suspected to be dead links:
 * - /orders/new (no page.tsx found)
 * - /broadcasts/new (no page.tsx found)
 * - /admin/centers/new (potential dead link)
 *
 * These tests DON'T assert pass/fail - they document actual behavior
 */

interface InvestigationResult {
  route: string;
  httpStatus: number;
  finalUrl: string;
  is404Page: boolean;
  hasRedirect: boolean;
  pageTitle: string;
  recommendation: string;
}

test.describe('High-Risk Routes Investigation', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('investigate /orders/new', async ({ page }) => {
    console.log('\n========== INVESTIGATING /orders/new ==========');

    const response = await page.goto('/orders/new', {
      waitUntil: 'networkidle',
      timeout: 10000,
    }).catch(() => null);

    const result: InvestigationResult = {
      route: '/orders/new',
      httpStatus: response?.status() || 0,
      finalUrl: page.url(),
      is404Page: false,
      hasRedirect: false,
      pageTitle: '',
      recommendation: '',
    };

    // Check if 404 page
    const is404 = await page.locator('text=404')
      .or(page.locator('text=Not Found'))
      .or(page.locator('text=찾을 수 없습니다'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    result.is404Page = is404;

    // Check for redirect
    result.hasRedirect = !result.finalUrl.includes('/orders/new');

    // Get page title
    result.pageTitle = await page.title().catch(() => 'N/A');

    // Determine recommendation
    if (result.is404Page || result.httpStatus === 404) {
      result.recommendation = '❌ Dead link - Remove from navigation or create the page';
    } else if (result.hasRedirect) {
      if (result.finalUrl.includes('/orders/upload')) {
        result.recommendation = '✅ Intentional redirect to /orders/upload - Update link to point directly';
      } else if (result.finalUrl.includes('/orders')) {
        result.recommendation = '✅ Redirects to /orders list - Update link or keep if intentional';
      } else {
        result.recommendation = `⚠️ Unexpected redirect to ${result.finalUrl} - Investigate further`;
      }
    } else {
      result.recommendation = '✅ Page exists - Verify functionality';
    }

    // Log findings
    console.log('HTTP Status:', result.httpStatus);
    console.log('Final URL:', result.finalUrl);
    console.log('Is 404 Page:', result.is404Page);
    console.log('Has Redirect:', result.hasRedirect);
    console.log('Page Title:', result.pageTitle);
    console.log('Recommendation:', result.recommendation);
    console.log('===============================================\n');

    // Soft assertion - document but don't fail
    expect(result).toBeTruthy();
  });

  test('investigate /broadcasts/new', async ({ page }) => {
    console.log('\n========== INVESTIGATING /broadcasts/new ==========');

    const response = await page.goto('/broadcasts/new', {
      waitUntil: 'networkidle',
      timeout: 10000,
    }).catch(() => null);

    const result: InvestigationResult = {
      route: '/broadcasts/new',
      httpStatus: response?.status() || 0,
      finalUrl: page.url(),
      is404Page: false,
      hasRedirect: false,
      pageTitle: '',
      recommendation: '',
    };

    // Check if 404 page
    const is404 = await page.locator('text=404')
      .or(page.locator('text=Not Found'))
      .or(page.locator('text=찾을 수 없습니다'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    result.is404Page = is404;

    // Check for redirect
    result.hasRedirect = !result.finalUrl.includes('/broadcasts/new');

    // Get page title
    result.pageTitle = await page.title().catch(() => 'N/A');

    // Determine recommendation
    if (result.is404Page || result.httpStatus === 404) {
      result.recommendation = '❌ Dead link - Remove from navigation or create the page';
    } else if (result.hasRedirect) {
      if (result.finalUrl.includes('/broadcasts/calendar')) {
        result.recommendation = '✅ Redirects to calendar - Update link or keep if intentional';
      } else if (result.finalUrl.includes('/broadcasts')) {
        result.recommendation = '✅ Redirects to broadcasts list - Update link to point directly';
      } else {
        result.recommendation = `⚠️ Unexpected redirect to ${result.finalUrl} - Investigate further`;
      }
    } else {
      result.recommendation = '✅ Page exists - Verify functionality';
    }

    // Log findings
    console.log('HTTP Status:', result.httpStatus);
    console.log('Final URL:', result.finalUrl);
    console.log('Is 404 Page:', result.is404Page);
    console.log('Has Redirect:', result.hasRedirect);
    console.log('Page Title:', result.pageTitle);
    console.log('Recommendation:', result.recommendation);
    console.log('===================================================\n');

    // Soft assertion
    expect(result).toBeTruthy();
  });

  test('investigate /admin/centers/new (ADMIN)', async ({ page }) => {
    // Switch to admin auth
    await page.context().addCookies([
      { name: 'next-auth.session-token', value: 'admin-token', domain: 'localhost', path: '/' },
    ]);

    console.log('\n========== INVESTIGATING /admin/centers/new ==========');

    const response = await page.goto('/admin/centers/new', {
      waitUntil: 'networkidle',
      timeout: 10000,
    }).catch(() => null);

    const result: InvestigationResult = {
      route: '/admin/centers/new',
      httpStatus: response?.status() || 0,
      finalUrl: page.url(),
      is404Page: false,
      hasRedirect: false,
      pageTitle: '',
      recommendation: '',
    };

    // Check if 404 page
    const is404 = await page.locator('text=404')
      .or(page.locator('text=Not Found'))
      .or(page.locator('text=찾을 수 없습니다'))
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    result.is404Page = is404;

    // Check for redirect
    result.hasRedirect = !result.finalUrl.includes('/admin/centers/new');

    // Get page title
    result.pageTitle = await page.title().catch(() => 'N/A');

    // Determine recommendation
    if (result.is404Page || result.httpStatus === 404) {
      result.recommendation = '❌ Dead link - Remove from navigation or create the page';
    } else if (result.hasRedirect) {
      if (result.finalUrl.includes('/admin/centers')) {
        result.recommendation = '✅ Redirects to centers list - Update link or keep if intentional';
      } else {
        result.recommendation = `⚠️ Unexpected redirect to ${result.finalUrl} - Investigate further`;
      }
    } else {
      result.recommendation = '✅ Page exists - Verify functionality';
    }

    // Log findings
    console.log('HTTP Status:', result.httpStatus);
    console.log('Final URL:', result.finalUrl);
    console.log('Is 404 Page:', result.is404Page);
    console.log('Has Redirect:', result.hasRedirect);
    console.log('Page Title:', result.pageTitle);
    console.log('Recommendation:', result.recommendation);
    console.log('======================================================\n');

    // Soft assertion
    expect(result).toBeTruthy();
  });
});

test.describe('High-Risk Routes - Summary Report Generation', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('generate comprehensive investigation report', async ({ page }) => {
    const routes = ['/orders/new', '/broadcasts/new', '/admin/centers/new'];

    const report = {
      timestamp: new Date().toISOString(),
      routes: [] as InvestigationResult[],
    };

    for (const route of routes) {
      const status = await getNavigationStatus(page, route);
      const finalUrl = page.url();

      const is404 = await page.locator('text=404').isVisible({ timeout: 2000 }).catch(() => false);

      const result: InvestigationResult = {
        route,
        httpStatus: status,
        finalUrl,
        is404Page: is404,
        hasRedirect: finalUrl !== route,
        pageTitle: await page.title().catch(() => 'N/A'),
        recommendation: '',
      };

      // Set recommendation
      if (is404 || status === 404) {
        result.recommendation = 'Remove from navigation or create page';
      } else if (result.hasRedirect) {
        result.recommendation = `Redirects to ${finalUrl} - consider updating link`;
      } else {
        result.recommendation = 'Page exists - verify functionality';
      }

      report.routes.push(result);
    }

    // Log complete report
    console.log('\n========== 404 ERROR INVESTIGATION REPORT ==========');
    console.log('Generated:', report.timestamp);
    console.log('\nHigh-Risk Routes Found:');

    report.routes.forEach((r, index) => {
      console.log(`\n${index + 1}. ${r.route}`);
      console.log(`   Status: ${r.httpStatus}`);
      console.log(`   Final URL: ${r.finalUrl}`);
      console.log(`   Is 404: ${r.is404Page}`);
      console.log(`   Recommendation: ${r.recommendation}`);
    });

    console.log('\n====================================================\n');

    // Write report to file (optional)
    // Can be used to track findings across test runs

    expect(report.routes.length).toBeGreaterThan(0);
  });
});
