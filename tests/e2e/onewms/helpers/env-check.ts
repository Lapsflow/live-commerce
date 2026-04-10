/**
 * Environment Check Helper for ONEWMS Integration Tests
 *
 * Provides utilities to validate ONEWMS credentials are configured
 * and skip tests gracefully when credentials are missing.
 */

import { test } from '@playwright/test';

/**
 * Skip integration tests if ONEWMS credentials are not configured
 *
 * Usage:
 * ```typescript
 * test.beforeAll(() => {
 *   skipIfCredentialsMissing();
 * });
 * ```
 */
export function skipIfCredentialsMissing() {
  const hasCredentials =
    process.env.ONEWMS_PARTNER_KEY &&
    process.env.ONEWMS_DOMAIN_KEY;

  test.skip(
    !hasCredentials,
    'ONEWMS credentials not configured - set ONEWMS_PARTNER_KEY and ONEWMS_DOMAIN_KEY environment variables'
  );
}

/**
 * Get test configuration with environment variables
 *
 * @returns Test configuration object
 */
export function getTestConfig() {
  return {
    hasCredentials: !!(
      process.env.ONEWMS_PARTNER_KEY &&
      process.env.ONEWMS_DOMAIN_KEY
    ),
    partnerKey: process.env.ONEWMS_PARTNER_KEY || '',
    domainKey: process.env.ONEWMS_DOMAIN_KEY || '',
    apiUrl: process.env.ONEWMS_API_URL || 'https://api.onewms.co.kr/api.php',
    baseUrl: process.env.BASE_URL || 'https://live-commerce-opal.vercel.app',
    databaseUrl: process.env.DATABASE_URL || '',
  };
}

/**
 * Validate that all required environment variables are set
 *
 * @returns Object with validation result and missing variables
 */
export function validateEnvironment() {
  const requiredVars = {
    ONEWMS_PARTNER_KEY: process.env.ONEWMS_PARTNER_KEY,
    ONEWMS_DOMAIN_KEY: process.env.ONEWMS_DOMAIN_KEY,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    isValid: missingVars.length === 0,
    missingVars,
    message: missingVars.length > 0
      ? `Missing environment variables: ${missingVars.join(', ')}`
      : 'All required environment variables are set',
  };
}
