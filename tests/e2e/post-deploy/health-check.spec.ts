/**
 * Post-Deployment Health Check Tests
 *
 * Fast critical path validation run immediately after deployment.
 * Tests focus on deployment-specific concerns: performance, errors, critical user flows.
 *
 * @post-deploy
 */

import { test, expect } from '@playwright/test';

test.describe('Post-Deployment Health Checks @post-deploy', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('H1: Login flow completes successfully within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to login page
    await page.goto('/login');

    // Fill credentials and submit
    await page.fill('input[type="email"]', 'admin1@live-commerce.com');
    await page.fill('input[type="password"]', 'admin1234');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Login flow completed in ${duration}ms`);

    // Performance assertion: should complete in < 3 seconds
    expect(duration).toBeLessThan(3000);

    // Verify dashboard loaded
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('H2: Dashboard loads within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Dashboard loaded in ${duration}ms`);

    // Performance assertion: should load in < 2 seconds
    expect(duration).toBeLessThan(2000);

    // Verify core UI elements are present
    await expect(page.locator('h1')).toBeVisible();
  });

  test('H3: No JavaScript console errors on dashboard', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check for console errors
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected:', consoleErrors);
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('H4: No 4xx/5xx API responses on dashboard load', async ({ page }) => {
    const failedRequests: Array<{ url: string; status: number }> = [];

    // Capture failed API requests
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();

      // Check for client errors (4xx) and server errors (5xx)
      if (status >= 400 && status < 600) {
        // Exclude expected 401s for unauthenticated requests
        if (!(status === 401 && url.includes('/api/'))) {
          failedRequests.push({ url, status });
        }
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Report failed requests
    if (failedRequests.length > 0) {
      console.error('❌ Failed API requests:', JSON.stringify(failedRequests, null, 2));
    }

    expect(failedRequests).toHaveLength(0);
  });

  test('H5: ONEWMS status widget renders correctly', async ({ page }) => {
    // Navigate to ONEWMS dashboard
    await page.goto('/dashboard/onewms');
    await page.waitForLoadState('networkidle');

    // Verify ONEWMS page title
    await expect(page.locator('h1')).toContainText('ONEWMS 통합 관리');

    // Verify status widget is present
    const statusWidget = page.locator('text=마지막 재고 동기화').first();
    await expect(statusWidget).toBeVisible();

    // Verify stat cards are visible
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();
    await expect(statsGrid).toBeVisible();

    // Verify at least one stat card has a value
    const statValue = statsGrid.locator('.text-3xl').first();
    await expect(statValue).toBeVisible();

    const value = await statValue.textContent();
    expect(value?.trim().length).toBeGreaterThan(0);

    console.log('✅ ONEWMS status widget rendered successfully');
  });

  test('H6: Navigation between pages works', async ({ page }) => {
    // Start at dashboard
    await page.goto('/dashboard');

    // Navigate to ONEWMS
    await page.click('a[href*="/dashboard/onewms"]');
    await expect(page).toHaveURL(/\/dashboard\/onewms/);
    await expect(page.locator('h1')).toContainText('ONEWMS');

    // Verify page loaded
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigation between pages works');
  });

  test('H7: Critical API endpoints respond successfully', async ({ request }) => {
    // Test ONEWMS stats endpoint
    const statsResponse = await request.get('/api/onewms/stats');
    expect(statsResponse.status()).toBe(200);

    const statsData = await statsResponse.json();
    expect(statsData).toHaveProperty('success');
    expect(statsData.success).toBe(true);

    console.log('✅ Critical API endpoints responding successfully');
  });

  test('H8: Page meta tags are present for SEO', async ({ page }) => {
    await page.goto('/');

    // Check for essential meta tags
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();

    console.log(`✅ Page title: "${title}"`);
    console.log('✅ SEO meta tags present');
  });
});
