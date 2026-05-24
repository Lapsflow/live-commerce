/**
 * ONEWMS-FMS API Configuration
 */

import { OnewmsConfig } from './types';

const DEFAULT_API_URL = 'https://api.onewms.co.kr/api.php';

export class OnewmsConfigManager {
  private static instance: OnewmsConfigManager;
  private config: OnewmsConfig | null = null;

  private constructor() {}

  static getInstance(): OnewmsConfigManager {
    if (!OnewmsConfigManager.instance) {
      OnewmsConfigManager.instance = new OnewmsConfigManager();
    }
    return OnewmsConfigManager.instance;
  }

  /**
   * Set ONEWMS configuration
   */
  setConfig(config: OnewmsConfig): void {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || DEFAULT_API_URL,
    };
  }

  /**
   * Get ONEWMS configuration
   */
  getConfig(): OnewmsConfig {
    if (!this.config) {
      throw new Error('ONEWMS config not initialized. Call setConfig() first.');
    }
    return this.config;
  }

  /**
   * Check if configuration is set
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Load configuration from environment variables
   *
   * Required: ONEWMS_PARTNER_KEY, ONEWMS_DOMAIN_KEY
   * Optional: ONEWMS_API_URL (defaults to https://api.onewms.co.kr/api.php)
   * P0 Required for set_orders: ONEWMS_SHOP_ID (판매처코드)
   * P0 Required for get_order_info: ONEWMS_SUB_DOMAIN_SEQ (화주번호) — 한국무진유통 = "62"
   */
  loadFromEnv(): void {
    const partnerKey = process.env.ONEWMS_PARTNER_KEY;
    const domainKey = process.env.ONEWMS_DOMAIN_KEY;
    const apiUrl = process.env.ONEWMS_API_URL;
    const shopId = process.env.ONEWMS_SHOP_ID;
    const subDomainSeq = process.env.ONEWMS_SUB_DOMAIN_SEQ;

    if (!partnerKey || !domainKey) {
      throw new Error(
        'Missing environment variables: ONEWMS_PARTNER_KEY and ONEWMS_DOMAIN_KEY are required'
      );
    }

    if (!shopId) {
      console.warn(
        '⚠️ ONEWMS_SHOP_ID not configured. set_orders API calls will fail.'
      );
    }

    if (!subDomainSeq) {
      console.warn(
        '⚠️ ONEWMS_SUB_DOMAIN_SEQ not configured. get_order_info will return "invalid sub_domain_seq".'
      );
    }

    this.setConfig({
      partnerKey,
      domainKey,
      apiUrl,
      shopId,
      subDomainSeq,
    });
  }
}

/**
 * Helper function to get config instance
 */
export function getOnewmsConfig(): OnewmsConfig {
  const manager = OnewmsConfigManager.getInstance();

  // Auto-load from env if not configured
  if (!manager.isConfigured()) {
    try {
      manager.loadFromEnv();
    } catch (error) {
      // Ignore if env vars not available
    }
  }

  return manager.getConfig();
}

/**
 * Helper function to set config
 */
export function setOnewmsConfig(config: OnewmsConfig): void {
  OnewmsConfigManager.getInstance().setConfig(config);
}

/**
 * Assert ONEWMS shop_id is configured
 * Called before operations requiring shop_id (e.g., set_orders)
 *
 * @throws Error if shopId not configured
 */
export function assertShopId(): string {
  const manager = OnewmsConfigManager.getInstance();

  // Auto-load from env if not configured
  if (!manager.isConfigured()) {
    try {
      manager.loadFromEnv();
    } catch (error) {
      // Ignore if env vars not available
    }
  }

  const config = manager.getConfig();
  if (!config.shopId) {
    throw new Error(
      '❌ ONEWMS_SHOP_ID not configured.\n' +
      'Run: pnpm tsx scripts/onewms-bootstrap-shop.ts\n' +
      'Then add ONEWMS_SHOP_ID to .env.local'
    );
  }

  return config.shopId;
}
