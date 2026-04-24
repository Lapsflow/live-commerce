import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/seller.json';

setup('authenticate as seller', async ({ page }) => {
  await page.goto('/login');
  // username 기반 로그인으로 변경
  await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'seller1');
  await page.fill('input[type="password"]', 'seller1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});
