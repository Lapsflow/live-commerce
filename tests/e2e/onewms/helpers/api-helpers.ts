/**
 * API Helper Utilities for ONEWMS Integration Tests
 *
 * Provides reusable functions for interacting with ONEWMS API endpoints
 * and validating responses in Playwright tests.
 */

import { Page, APIRequestContext } from '@playwright/test';

/**
 * Helper class for ONEWMS API interactions
 */
export class OnewmsApiHelper {
  constructor(private request: APIRequestContext) {}

  /**
   * Get dashboard statistics
   */
  async getStats() {
    const response = await this.request.get('/api/onewms/stats');
    return response.json();
  }

  /**
   * Trigger manual stock synchronization
   */
  async triggerStockSync() {
    const response = await this.request.post('/api/onewms/stock/sync');
    return response.json();
  }

  /**
   * Get list of stock conflicts
   */
  async getConflicts() {
    const response = await this.request.get('/api/onewms/stock/conflicts');
    return response.json();
  }

  /**
   * Retry failed order synchronizations
   */
  async retryFailedOrders() {
    const response = await this.request.post('/api/onewms/orders/retry');
    return response.json();
  }

  /**
   * Get order sync status
   */
  async getOrderStatus(orderId: string) {
    const response = await this.request.get(`/api/onewms/orders/${orderId}/status`);
    return response.json();
  }
}

/**
 * Wait for a specific API call to complete
 *
 * @param page - Playwright page instance
 * @param endpoint - API endpoint to wait for (e.g., '/api/onewms/stats')
 * @param timeout - Timeout in milliseconds (default: 15000)
 * @returns Promise that resolves when API call completes
 */
export async function waitForApiCall(
  page: Page,
  endpoint: string,
  timeout: number = 15000
) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(endpoint) &&
      response.status() === 200,
    { timeout }
  );
}

/**
 * Verify that data is real (not mocked)
 *
 * Mocked test data has specific hardcoded values:
 * - orders.total === 156
 * - orders.failed === 3
 * - stock.conflicts === 5
 *
 * @param statsData - Stats response data to check
 * @returns true if data is real (not mocked), false if mocked
 */
export function isRealData(statsData: any): boolean {
  // Check if data matches mocked values from mock-routes.ts
  const isMockedData =
    statsData.orders.total === 156 &&
    statsData.orders.failed === 3 &&
    statsData.stock.conflicts === 5;

  return !isMockedData;
}

/**
 * Verify timestamp is recent (within specified minutes)
 *
 * @param timestamp - ISO timestamp string to check
 * @param withinMinutes - Number of minutes to consider "recent" (default: 5)
 * @returns true if timestamp is recent, false otherwise
 */
export function isRecentTimestamp(
  timestamp: string,
  withinMinutes: number = 5
): boolean {
  const timestampDate = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestampDate.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes >= 0 && diffMinutes <= withinMinutes;
}

/**
 * Extract relative time text from UI (e.g., "5분 전", "방금 전")
 *
 * @param text - Text content that may contain relative time
 * @returns Extracted relative time string or null
 */
export function extractRelativeTime(text: string | null): string | null {
  if (!text) return null;

  const patterns = [
    /방금 전/,
    /(\d+)분 전/,
    /(\d+)시간 전/,
    /(\d+)일 전/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

/**
 * Parse Korean datetime string to Date object
 *
 * Handles formats like: "2026-04-10 14:30"
 *
 * @param dateTimeString - Korean datetime string
 * @returns Date object or null if parsing fails
 */
export function parseKoreanDateTime(dateTimeString: string): Date | null {
  const match = dateTimeString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hours, minutes] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1, // Month is 0-indexed
    parseInt(day),
    parseInt(hours),
    parseInt(minutes)
  );
}

/**
 * Validate stats response structure
 *
 * @param data - Stats response data to validate
 * @returns Object with validation result and errors
 */
export function validateStatsStructure(data: any) {
  const errors: string[] = [];

  // Check top-level structure
  if (!data.success) errors.push('Missing success field');
  if (!data.data) errors.push('Missing data field');
  if (!data.data.orders) errors.push('Missing data.orders field');
  if (!data.data.stock) errors.push('Missing data.stock field');
  if (!data.data.timestamp) errors.push('Missing data.timestamp field');

  // Check orders structure
  if (typeof data.data.orders.total !== 'number') {
    errors.push('orders.total should be number');
  }
  if (typeof data.data.orders.pending !== 'number') {
    errors.push('orders.pending should be number');
  }
  if (typeof data.data.orders.failed !== 'number') {
    errors.push('orders.failed should be number');
  }
  if (typeof data.data.orders.shipped !== 'number') {
    errors.push('orders.shipped should be number');
  }
  if (typeof data.data.orders.successRate !== 'number') {
    errors.push('orders.successRate should be number');
  }

  // Check stock structure
  if (typeof data.data.stock.conflicts !== 'number') {
    errors.push('stock.conflicts should be number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
