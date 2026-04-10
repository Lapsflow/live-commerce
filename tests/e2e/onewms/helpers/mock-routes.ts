import { Page } from '@playwright/test';

export async function mockOnewmsAPIs(page: Page) {
  // Mock stats API
  await page.route('**/api/onewms/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          orders: {
            total: 156,
            pending: 12,
            failed: 3,
            shipped: 141,
            successRate: 98.1,
          },
          stock: {
            conflicts: 5,
            lastSync: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        },
      }),
    });
  });

  // Mock conflicts API
  await page.route('**/api/onewms/stock/conflicts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        count: 0,
      }),
    });
  });

  // Mock failed orders API
  await page.route('**/api/onewms/orders/failed', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
      }),
    });
  });
}
