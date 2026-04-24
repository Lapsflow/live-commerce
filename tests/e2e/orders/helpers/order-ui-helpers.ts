import { Page, expect } from '@playwright/test';

export function setupConfirmDialogAccept(page: Page) {
  page.once('dialog', (dialog) => dialog.accept());
}

export function setupConfirmDialogDismiss(page: Page) {
  page.once('dialog', (dialog) => dialog.dismiss());
}

export async function expectToast(page: Page, message: string) {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 10000 });
}

export async function waitForOrdersApi(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.url().includes('/api/orders') &&
      !res.url().includes('/stats') &&
      !res.url().includes('/confirm-payment') &&
      !res.url().includes('/cancel') &&
      !res.url().includes('/export') &&
      res.status() === 200,
    { timeout: 15000 }
  );
}

export async function waitForStatsApi(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes('/api/orders/stats') && res.status() === 200,
    { timeout: 15000 }
  );
}

export async function navigateToOrders(page: Page) {
  await page.goto('/orders');
  await page.waitForLoadState('networkidle');
}

export async function navigateToOrderDetail(page: Page, orderId: string) {
  await page.goto(`/orders/${orderId}`);
  await page.waitForLoadState('networkidle');
}
