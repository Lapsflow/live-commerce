/**
 * ONEWMS Dashboard - Real Data Integration Tests
 *
 * Verifies dashboard displays real data from database and API.
 * Tests correlation between UI display and actual API responses.
 *
 * @integration
 */

import { test, expect } from '@playwright/test';
import { skipIfCredentialsMissing } from './helpers/env-check';
import { OnewmsApiHelper, parseKoreanDateTime } from './helpers/api-helpers';

test.describe('ONEWMS Dashboard - Real Data Integration @integration', () => {
  test.beforeAll(() => {
    skipIfCredentialsMissing();
  });

  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to ONEWMS dashboard
    await page.goto('/dashboard/onewms');
    await page.waitForLoadState('networkidle');
  });

  test('I9: Dashboard loads real statistics', async ({ page, request }) => {
    // 1. Fetch stats directly from API
    const api = new OnewmsApiHelper(request);
    const apiData = await api.getStats();

    // 2. Extract UI values from stat cards
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();

    // Total orders card
    const totalOrdersCard = statsGrid.locator('text=총 동기화 주문').locator('../..');
    const totalOrdersValue = await totalOrdersCard.locator('.text-3xl').textContent();

    // Success rate card
    const successRateCard = statsGrid.locator('text=동기화 성공률').locator('../..');
    const successRateValue = await successRateCard.locator('.text-3xl').textContent();

    // Failed orders card
    const failedOrdersCard = statsGrid.locator('text=실패 주문').locator('../..');
    const failedOrdersValue = await failedOrdersCard.locator('.text-3xl').textContent();

    // Stock conflicts card
    const conflictsCard = statsGrid.locator('text=재고 충돌').locator('../..');
    const conflictsValue = await conflictsCard.locator('.text-3xl').textContent();

    // 3. Compare UI with API data
    expect(Number(totalOrdersValue)).toBe(apiData.data.orders.total);
    expect(parseFloat(successRateValue || '0')).toBe(apiData.data.orders.successRate);
    expect(Number(failedOrdersValue)).toBe(apiData.data.orders.failed);
    expect(Number(conflictsValue)).toBe(apiData.data.stock.conflicts);

    console.log('✅ UI/API data correlation verified:');
    console.log(`   Total orders: UI=${totalOrdersValue}, API=${apiData.data.orders.total}`);
    console.log(`   Success rate: UI=${successRateValue}%, API=${apiData.data.orders.successRate}%`);
    console.log(`   Failed orders: UI=${failedOrdersValue}, API=${apiData.data.orders.failed}`);
    console.log(`   Conflicts: UI=${conflictsValue}, API=${apiData.data.stock.conflicts}`);
  });

  test('I10: Last sync timestamp is realistic', async ({ page }) => {
    // Look for last sync timestamp
    const syncTimeSection = page.locator('text=마지막 재고 동기화').first();
    await expect(syncTimeSection).toBeVisible();

    const syncTimeText = await syncTimeSection.locator('../..').textContent();
    expect(syncTimeText).toBeTruthy();

    // Extract full datetime (format: "2026-04-10 오후 2:30" or "2026-04-10 14:30")
    const fullText = syncTimeText || '';
    const timestampMatch = fullText.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/);

    if (timestampMatch) {
      const syncDate = parseKoreanDateTime(timestampMatch[0]);
      expect(syncDate).toBeTruthy();

      if (syncDate) {
        const now = new Date();

        // Verify timestamp is not in the future
        expect(syncDate.getTime()).toBeLessThanOrEqual(now.getTime());

        // Verify timestamp is recent (within last 24 hours)
        const hoursDiff = (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60);
        expect(hoursDiff).toBeGreaterThanOrEqual(0);
        expect(hoursDiff).toBeLessThan(24);

        console.log('✅ Last sync timestamp validation:');
        console.log(`   Timestamp: ${timestampMatch[0]}`);
        console.log(`   Hours ago: ${hoursDiff.toFixed(2)}`);
        console.log(`   Within 24h: ${hoursDiff < 24 ? 'Yes' : 'No'}`);
      }
    } else {
      // If no specific timestamp, check for relative time (e.g., "5분 전")
      const relativeTimeMatch = fullText.match(/(\d+)분 전|(\d+)시간 전|방금 전/);
      expect(relativeTimeMatch).toBeTruthy();

      console.log('✅ Relative time displayed:', relativeTimeMatch?.[0]);
    }
  });

  test('I11: Stats values are non-negative integers', async ({ page }) => {
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();

    const statsCards = [
      { name: '총 동기화 주문', minValue: 0 },
      { name: '실패 주문', minValue: 0 },
      { name: '재고 충돌', minValue: 0 },
    ];

    for (const card of statsCards) {
      const cardElement = statsGrid.locator(`text=${card.name}`).locator('../..');
      const valueText = await cardElement.locator('.text-3xl').textContent();

      // Convert to number
      const numValue = Number(valueText);

      // Verify it's a valid number
      expect(isNaN(numValue)).toBe(false);

      // Verify non-negative
      expect(numValue).toBeGreaterThanOrEqual(card.minValue);

      // Verify it's an integer (not decimal)
      expect(Number.isInteger(numValue)).toBe(true);

      console.log(`✅ ${card.name}: ${numValue} (valid)`);
    }

    // Success rate can be decimal, so handle separately
    const successRateCard = statsGrid.locator('text=동기화 성공률').locator('../..');
    const successRateText = await successRateCard.locator('.text-3xl').textContent();
    const successRate = parseFloat(successRateText || '0');

    expect(isNaN(successRate)).toBe(false);
    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(100);

    console.log(`✅ 동기화 성공률: ${successRate}% (valid)`);
  });
});
