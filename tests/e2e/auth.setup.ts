import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/admin.json';

setup('authenticate as master (default auth)', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
  await page.fill('input[type="password"]', 'master1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});
