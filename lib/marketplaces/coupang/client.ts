/**
 * Coupang Partners API Client
 * API Documentation: https://developers.coupangcorp.com/
 * Rate Limit: Varies by endpoint (typically 1,000-10,000 requests/day)
 */

import { createHmac } from 'crypto';
import {
  CoupangConfig,
  CoupangSearchResponse,
  CoupangProduct,
  CoupangApiError,
  CoupangProductSummary,
  PriceStatistics,
} from './types';
import { getCoupangConfig } from './config';

export class CoupangClient {
  private config: CoupangConfig;
  private requestCount: number = 0;
  private lastResetDate: Date = new Date();

  constructor(config?: CoupangConfig) {
    this.config = config || getCoupangConfig();
  }

  /**
   * Generate HMAC signature for Coupang API
   */
  private generateSignature(
    method: string,
    path: string,
    timestamp: string
  ): string {
    const message = `${method}${path}${timestamp}`;
    const hmac = createHmac('sha256', this.config.secretKey);
    hmac.update(message);
    return hmac.digest('hex');
  }

  /**
   * Make API request
   */
  private async request<T>(
    path: string,
    method: string = 'GET',
    params?: Record<string, string | number>
  ): Promise<T> {
    // Rate limit check
    this.checkRateLimit();

    const timestamp = Date.now().toString();
    const signature = this.generateSignature(method, path, timestamp);

    const url = new URL(path, this.config.apiUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessKey}`,
          'X-Timestamp': timestamp,
          'X-Signature': signature,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.rMessage || `HTTP error! status: ${response.status}`
        ) as CoupangApiError;
        error.errorCode = errorData.rCode || 'UNKNOWN';
        error.errorMessage = errorData.rMessage || 'Unknown API error';
        error.statusCode = response.status;
        throw error;
      }

      const data: T = await response.json();
      this.incrementRequestCount();

      return data;
    } catch (error) {
      if ((error as CoupangApiError).errorCode) {
        throw error;
      }
      const apiError = new Error(
        error instanceof Error ? error.message : 'Network error'
      ) as CoupangApiError;
      apiError.errorCode = 'NETWORK_ERROR';
      apiError.errorMessage = error instanceof Error ? error.message : 'Network error';
      apiError.statusCode = -1;
      throw apiError;
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): void {
    const now = new Date();
    const lastDate = this.lastResetDate;

    // Reset count if new day
    if (
      now.getFullYear() !== lastDate.getFullYear() ||
      now.getMonth() !== lastDate.getMonth() ||
      now.getDate() !== lastDate.getDate()
    ) {
      this.requestCount = 0;
      this.lastResetDate = now;
    }

    if (this.requestCount >= 10000) {
      throw new Error('Coupang API daily rate limit exceeded (10,000 requests/day)');
    }
  }

  /**
   * Increment request count
   */
  private incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Search products
   * @param query - Search query
   * @param options - Search options
   */
  async searchProducts(
    query: string,
    options: {
      limit?: number; // 결과 개수 (1-100, 기본 20)
      page?: number; // 페이지 번호 (기본 1)
    } = {}
  ): Promise<CoupangProductSummary> {
    const { limit = 20, page = 1 } = options;

    const response = await this.request<CoupangSearchResponse>(
      '/v2/providers/affiliate_open_api/apis/openapi/products/search',
      'GET',
      {
        keyword: query,
        limit,
        page,
      }
    );

    if (response.rCode !== '0') {
      throw new Error(`Coupang API error: ${response.rMessage}`);
    }

    const products = response.data?.productData || [];

    // Calculate price statistics
    const prices = products
      .map((item) => item.productPrice)
      .filter((price) => !isNaN(price) && price > 0);

    const statistics: PriceStatistics = {
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      avgPrice:
        prices.length > 0
          ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
          : 0,
      count: prices.length,
    };

    return {
      products,
      statistics,
      total: products.length,
    };
  }

  /**
   * Get product by barcode
   * @param barcode - Product barcode
   */
  async getProductByBarcode(barcode: string): Promise<CoupangProductSummary | null> {
    try {
      // Search by barcode
      const result = await this.searchProducts(barcode, {
        limit: 10,
      });

      if (result.products.length === 0) {
        return null;
      }

      return result;
    } catch (error) {
      console.error('Failed to search by barcode:', error);
      return null;
    }
  }
}

/**
 * Create a new Coupang client instance
 */
export function createCoupangClient(config?: CoupangConfig): CoupangClient {
  return new CoupangClient(config);
}
