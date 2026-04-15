import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/seller.json';

setup('authenticate as seller', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'seller1@live-commerce.com');
  await page.fill('input[type="password"]', 'seller1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});
