/**
 * Navigation Helper Utilities
 * Provides reusable functions for navigation testing
 */

import { Page } from '@playwright/test';

/**
 * Navigate to URL and check if 404 error appears
 */
export async function navigateAndCheck404(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

    // Check for 404 indicators
    const is404Text = await page.locator('text=404').isVisible({ timeout: 2000 }).catch(() => false);
    const isNotFound = await page.locator('text=찾을 수 없습니다').isVisible({ timeout: 2000 }).catch(() => false);
    const isPageNotFound = await page.locator('text=Page Not Found').isVisible({ timeout: 2000 }).catch(() => false);

    return is404Text || isNotFound || isPageNotFound;
  } catch (error) {
    // Navigation timeout or error likely indicates 404
    return true;
  }
}

/**
 * Get all link hrefs from current page
 */
export async function getAllLinks(page: Page): Promise<string[]> {
  try {
    const links = await page.locator('a').all();
    const hrefs = await Promise.all(
      links.map(async (link) => {
        const href = await link.getAttribute('href');
        return href;
      })
    );
    return hrefs.filter((href): href is string => href !== null && href !== '');
  } catch (error) {
    console.error('Failed to get links:', error);
    return [];
  }
}

/**
 * Click element and wait for navigation to complete
 */
export async function clickAndWaitForNavigation(page: Page, selector: string): Promise<void> {
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 10000 }),
    page.click(selector),
  ]);
}

/**
 * Check if current page is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const url = page.url();
  // If redirected to login, not authenticated
  if (url.includes('/login') || url.includes('/signin')) {
    return false;
  }

  // Check for common authenticated page elements
  const hasNav = await page.locator('nav').isVisible({ timeout: 2000 }).catch(() => false);
  return hasNav;
}

/**
 * Wait for API response and check status
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<{ status: number; ok: boolean }> {
  try {
    const response = await page.waitForResponse(
      (resp) => {
        const url = resp.url();
        if (typeof urlPattern === 'string') {
          return url.includes(urlPattern);
        }
        return urlPattern.test(url);
      },
      { timeout }
    );

    return {
      status: response.status(),
      ok: response.ok(),
    };
  } catch (error) {
    return { status: 0, ok: false };
  }
}

/**
 * Get response status code for a navigation
 */
export async function getNavigationStatus(page: Page, url: string): Promise<number> {
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    return response?.status() || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Check if element exists on page
 */
export async function elementExists(page: Page, selector: string, timeout = 2000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scroll to element and ensure it's visible
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await element.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `screenshots/${name}-${timestamp}.png`, fullPage: true });
}
