/**
 * ONEWMS Import API E2E Test
 * Tests product import and order import endpoints via browser context.
 * Uses batch mode to stay within Vercel 10s function limit.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://supermujin.ai';

test.describe('ONEWMS Import API', () => {
  test('POST /api/onewms/products/import - import products page 1', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log('MASTER login successful');

    // Import page 1 (100 products, no stock sync)
    const result = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/onewms/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, limit: 100, syncStock: false }),
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    console.log('Product import status:', result.status);
    console.log('Product import result:', JSON.stringify(result.body, null, 2));

    expect(result.status).toBe(200);
    expect(result.body.data).toBeDefined();
    expect(result.body.data.products).toBeDefined();
    expect(result.body.data.products.total).toBeGreaterThan(0);
    expect(result.body.data.products.hasMore).toBe(true);
    console.log(`Products page 1: ${result.body.data.products.created} created, ${result.body.data.products.updated} updated, hasMore=${result.body.data.products.hasMore}`);

    await context.close();
  });

  test('POST /api/onewms/orders/import - import orders', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log('MASTER login successful');

    const result = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/onewms/orders/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: '2026-04-01',
          end_date: '2026-04-10',
        }),
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    console.log('Order import status:', result.status);
    console.log('Order import result:', JSON.stringify(result.body, null, 2));

    expect(result.status).toBe(200);
    expect(result.body.data).toBeDefined();
    expect(result.body.data.orders).toBeDefined();
    expect(result.body.data.orders.total).toBeGreaterThan(0);
    console.log(`Orders: ${result.body.data.orders.created} created, ${result.body.data.orders.skipped} skipped, ${result.body.data.orders.errors} errors`);

    await context.close();
  });
});
