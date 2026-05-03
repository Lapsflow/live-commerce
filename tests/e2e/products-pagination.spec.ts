/**
 * Products page pagination test
 * Tests page size changes (20, 30, 50) and navigation
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://www.supermujin.ai';

test.describe('Products Page Pagination', () => {
  test.beforeEach(async ({ browser }, testInfo) => {
    // Increase timeout for all tests
    testInfo.setTimeout(60000);
  });

  test('API: different page sizes return correct data', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Test each page size via API
    for (const pageSize of [20, 30, 50]) {
      const result = await page.evaluate(async ({ baseUrl, size }) => {
        const res = await fetch(`${baseUrl}/api/products?pageIndex=0&pageSize=${size}`);
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return { status: res.status, body: json, raw: null };
        } catch {
          return { status: res.status, body: null, raw: text.substring(0, 500) };
        }
      }, { baseUrl: BASE_URL, size: pageSize });

      console.log(`\nAPI pageSize=${pageSize}: status=${result.status}`);
      if (result.body) {
        console.log(`  data.length=${result.body.data?.length}, totalCount=${result.body.totalCount}, pageCount=${result.body.pageCount}`);
        expect(result.status).toBe(200);
        expect(result.body.data).toBeDefined();
        expect(result.body.data.length).toBeLessThanOrEqual(pageSize);
        expect(result.body.totalCount).toBeGreaterThan(0);
        expect(result.body.pageCount).toBe(Math.ceil(result.body.totalCount / pageSize));
      } else {
        console.log(`  ERROR raw response: ${result.raw}`);
      }
    }

    // Test page 2
    const page2Result = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/products?pageIndex=1&pageSize=20`);
      return { status: res.status, body: await res.json() };
    }, BASE_URL);
    console.log(`\nAPI page 2 (pageSize=20): status=${page2Result.status}, data.length=${page2Result.body.data?.length}`);
    expect(page2Result.status).toBe(200);

    await context.close();
  });

  test('API: productType filter with pagination', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Test productType filter + pagination
    for (const productType of ['HEADQUARTERS', 'CENTER']) {
      const result = await page.evaluate(async ({ baseUrl, type }) => {
        const res = await fetch(`${baseUrl}/api/products?productType=${type}&pageIndex=0&pageSize=20`);
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return { status: res.status, body: json, raw: null };
        } catch {
          return { status: res.status, body: null, raw: text.substring(0, 500) };
        }
      }, { baseUrl: BASE_URL, type: productType });

      console.log(`\nAPI productType=${productType}: status=${result.status}`);
      if (result.body) {
        console.log(`  data.length=${result.body.data?.length}, totalCount=${result.body.totalCount}`);
      } else {
        console.log(`  ERROR raw: ${result.raw}`);
      }
    }

    await context.close();
  });

  test('UI: navigate to products page and change page sizes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Listen for console errors and network failures
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('/api/products') && response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Navigate to products
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check initial state
    const initialRows = await page.locator('table tbody tr').count();
    console.log(`\nInitial table rows: ${initialRows}`);

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/products-initial.png' });

    // Check if pagination is visible
    const paginationText = await page.locator('text=/페이지당/').isVisible();
    console.log(`Pagination visible: ${paginationText}`);

    // Try changing page size via select dropdown
    const pageSizeSelect = page.locator('button:has-text("20")').first();
    if (await pageSizeSelect.isVisible()) {
      console.log('\nFound page size select, current value appears to be 20');

      // Change to 30
      await pageSizeSelect.click();
      await page.waitForTimeout(500);
      const option30 = page.getByRole('option', { name: '30' });
      if (await option30.isVisible()) {
        await option30.click();
        await page.waitForTimeout(2000);
        const rowsAfter30 = await page.locator('table tbody tr').count();
        console.log(`After selecting 30: ${rowsAfter30} rows`);
        await page.screenshot({ path: 'tests/screenshots/products-pagesize-30.png' });
      }

      // Change to 50
      const pageSizeSelect2 = page.locator('button:has-text("30")').first();
      if (await pageSizeSelect2.isVisible()) {
        await pageSizeSelect2.click();
        await page.waitForTimeout(500);
        const option50 = page.getByRole('option', { name: '50' });
        if (await option50.isVisible()) {
          await option50.click();
          await page.waitForTimeout(2000);
          const rowsAfter50 = await page.locator('table tbody tr').count();
          console.log(`After selecting 50: ${rowsAfter50} rows`);
          await page.screenshot({ path: 'tests/screenshots/products-pagesize-50.png' });
        }
      }

      // Change back to 20
      const pageSizeSelect3 = page.locator('button:has-text("50")').first();
      if (await pageSizeSelect3.isVisible()) {
        await pageSizeSelect3.click();
        await page.waitForTimeout(500);
        const option20 = page.getByRole('option', { name: '20' });
        if (await option20.isVisible()) {
          await option20.click();
          await page.waitForTimeout(2000);
          const rowsAfter20 = await page.locator('table tbody tr').count();
          console.log(`After selecting 20: ${rowsAfter20} rows`);
        }
      }
    } else {
      console.log('Page size select not found, trying alternative selector...');
      // Try to find by role
      const selectTrigger = page.locator('[role="combobox"]').first();
      if (await selectTrigger.isVisible()) {
        console.log('Found combobox, clicking...');
        await selectTrigger.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/products-select-open.png' });
      }
    }

    // Test "본사 WMS" filter
    console.log('\n--- Testing 본사 WMS filter ---');
    const wmsButton = page.getByRole('button', { name: '본사 WMS', exact: true });
    if (await wmsButton.isVisible()) {
      await wmsButton.click();
      await page.waitForTimeout(3000);
      const wmsRows = await page.locator('table tbody tr').count();
      console.log(`본사 WMS filter: ${wmsRows} rows`);
      await page.screenshot({ path: 'tests/screenshots/products-wms-filter.png' });
    }

    // Test "센터 자사몰" filter
    console.log('\n--- Testing 센터 자사몰 filter ---');
    const centerButton = page.getByRole('button', { name: '센터 자사몰', exact: true });
    if (await centerButton.isVisible()) {
      await centerButton.click();
      await page.waitForTimeout(3000);
      const centerRows = await page.locator('table tbody tr').count();
      console.log(`센터 자사몰 filter: ${centerRows} rows`);
      await page.screenshot({ path: 'tests/screenshots/products-center-filter.png' });
    }

    // Report errors
    console.log(`\n=== ERROR SUMMARY ===`);
    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach((e) => console.log(`  [console] ${e}`));
    console.log(`Network errors: ${networkErrors.length}`);
    networkErrors.forEach((e) => console.log(`  [network] ${e}`));

    await context.close();
  });
});
