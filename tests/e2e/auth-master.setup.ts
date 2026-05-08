import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/master.json';

setup('authenticate as master', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
  await page.fill('input[type="password"]', 'master1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.context().storageState({ path: authFile });
});
