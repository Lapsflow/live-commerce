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
   */
  loadFromEnv(): void {
    const partnerKey = process.env.ONEWMS_PARTNER_KEY;
    const domainKey = process.env.ONEWMS_DOMAIN_KEY;
    const apiUrl = process.env.ONEWMS_API_URL;

    if (!partnerKey || !domainKey) {
      throw new Error(
        'Missing environment variables: ONEWMS_PARTNER_KEY and ONEWMS_DOMAIN_KEY are required'
      );
    }

    this.setConfig({
      partnerKey,
      domainKey,
      apiUrl,
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
