import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin1@live-commerce.com');
  await page.fill('input[type="password"]', 'admin1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});
