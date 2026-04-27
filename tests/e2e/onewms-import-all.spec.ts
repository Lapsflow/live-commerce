/**
 * ONEWMS Full Import - Import all products (all pages) and orders
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://supermujin.ai';

test.describe('ONEWMS Full Import', () => {
  test.setTimeout(600000); // 10 min for full import (1044 products across 11 pages)

  test('Import ALL products (all pages)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log('MASTER login successful');

    let currentPage = 1;
    let hasMore = true;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    while (hasMore) {
      const result = await page.evaluate(async ({ baseUrl, pg }) => {
        const res = await fetch(`${baseUrl}/api/onewms/products/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: pg, limit: 100, syncStock: false }),
        });
        return { status: res.status, body: await res.json() };
      }, { baseUrl: BASE_URL, pg: currentPage });

      expect(result.status).toBe(200);
      const data = result.body.data;
      console.log(`Page ${currentPage}: ${data.products.created} created, ${data.products.updated} updated, ${data.products.errors} errors, hasMore=${data.products.hasMore}`);

      totalCreated += data.products.created;
      totalUpdated += data.products.updated;
      totalErrors += data.products.errors;
      hasMore = data.products.hasMore;
      currentPage++;
    }

    console.log(`\n=== PRODUCT IMPORT COMPLETE ===`);
    console.log(`Total created: ${totalCreated}`);
    console.log(`Total updated: ${totalUpdated}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Pages processed: ${currentPage - 1}`);

    await context.close();
  });

  test('Import ALL orders (full date range, paginated)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log('MASTER login successful');

    let currentPage = 1;
    let hasMore = true;
    let totalFetched = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalProductsAutoCreated = 0;

    while (hasMore) {
      const result = await page.evaluate(async ({ baseUrl, pg }) => {
        const res = await fetch(`${baseUrl}/api/onewms/orders/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: '2026-01-01',
            end_date: '2026-04-22',
            page: pg,
            limit: 50,
          }),
        });
        return { status: res.status, body: await res.json() };
      }, { baseUrl: BASE_URL, pg: currentPage });

      expect(result.status).toBe(200);
      const data = result.body.data;
      console.log(`Page ${currentPage}: ${data.orders.total} fetched, ${data.orders.created} created, ${data.orders.skipped} skipped, ${data.orders.errors} errors, hasMore=${data.orders.hasMore}`);

      totalFetched += data.orders.total;
      totalCreated += data.orders.created;
      totalSkipped += data.orders.skipped;
      totalErrors += data.orders.errors;
      totalProductsAutoCreated += data.orders.productsAutoCreated || 0;
      hasMore = data.orders.hasMore;
      currentPage++;
    }

    console.log(`\n=== ORDER IMPORT COMPLETE ===`);
    console.log(`Total fetched: ${totalFetched}`);
    console.log(`Total created: ${totalCreated}`);
    console.log(`Total skipped: ${totalSkipped}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Products auto-created: ${totalProductsAutoCreated}`);
    console.log(`Pages processed: ${currentPage - 1}`);

    await context.close();
  });
});
