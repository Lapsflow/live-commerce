/**
 * ONEWMS API Integration - Connectivity Tests
 *
 * Verifies ONEWMS API is reachable and returns real data.
 * Tests skip automatically if ONEWMS credentials are not configured.
 *
 * @integration
 */

import { test, expect } from '@playwright/test';
import { skipIfCredentialsMissing, getTestConfig } from './helpers/env-check';
import { OnewmsApiHelper, isRealData, isRecentTimestamp, validateStatsStructure } from './helpers/api-helpers';

test.describe('ONEWMS API Integration - Connectivity @integration', () => {
  // Skip entire suite if credentials missing
  test.beforeAll(() => {
    skipIfCredentialsMissing();
  });

  // Use admin auth for all tests
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('I1: Stats endpoint returns real data (not mocked)', async ({ request }) => {
    // Create API helper
    const api = new OnewmsApiHelper(request);

    // Fetch stats
    const response = await api.getStats();

    // Verify success
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();

    // Verify it's NOT mocked data
    const isReal = isRealData(response.data);
    expect(isReal).toBe(true);

    console.log('✅ Real ONEWMS data received:');
    console.log(`   Total orders: ${response.data.orders.total}`);
    console.log(`   Success rate: ${response.data.orders.successRate}%`);
    console.log(`   Stock conflicts: ${response.data.stock.conflicts}`);
  });

  test('I2: Stats response has valid structure', async ({ request }) => {
    const api = new OnewmsApiHelper(request);
    const response = await api.getStats();

    // Validate structure
    const validation = validateStatsStructure(response);

    if (!validation.isValid) {
      console.error('❌ Invalid response structure:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
    }

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Verify data types explicitly
    expect(typeof response.data.orders.total).toBe('number');
    expect(typeof response.data.orders.pending).toBe('number');
    expect(typeof response.data.orders.failed).toBe('number');
    expect(typeof response.data.orders.shipped).toBe('number');
    expect(typeof response.data.orders.successRate).toBe('number');
    expect(typeof response.data.stock.conflicts).toBe('number');

    // Verify timestamp is ISO string
    expect(response.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Verify timestamp is recent (within last 5 minutes)
    const isRecent = isRecentTimestamp(response.data.timestamp, 5);
    expect(isRecent).toBe(true);
  });

  test('I3: Unauthorized request returns 401', async ({ request }) => {
    // Create new request context WITHOUT authentication
    const unauthRequest = await request.newContext({
      // No auth cookies
    });

    // Attempt to fetch stats without auth
    const response = await unauthRequest.get('/api/onewms/stats');

    // Verify 401 Unauthorized
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBeDefined();

    await unauthRequest.dispose();
  });

  test('I4: Environment variables are loaded', async () => {
    const config = getTestConfig();

    // Verify credentials are present
    expect(config.hasCredentials).toBe(true);
    expect(config.partnerKey).toBeTruthy();
    expect(config.domainKey).toBeTruthy();

    // Verify API URL is configured
    expect(config.apiUrl).toMatch(/https:\/\/api\.onewms\.co\.kr/);

    // Log configuration (without exposing full keys)
    console.log('✅ Environment configuration:');
    console.log(`   Partner Key: ${config.partnerKey.substring(0, 8)}...`);
    console.log(`   Domain Key: ${config.domainKey.substring(0, 8)}...`);
    console.log(`   API URL: ${config.apiUrl}`);
  });
});
