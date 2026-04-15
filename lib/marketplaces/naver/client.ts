/**
 * Naver Shopping API Client
 * API Documentation: https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md
 * Rate Limit: 25,000 requests/day
 */

import {
  NaverConfig,
  NaverShoppingSearchResponse,
  NaverShoppingProduct,
  NaverApiError,
  NaverProductSummary,
  PriceStatistics,
} from './types';
import { getNaverConfig } from './config';

export class NaverShoppingClient {
  private config: NaverConfig;
  private requestCount: number = 0;
  private lastResetDate: Date = new Date();

  constructor(config?: NaverConfig) {
    this.config = config || getNaverConfig();
  }

  /**
   * Make API request
   */
  private async request(
    endpoint: string,
    params: Record<string, string | number>
  ): Promise<NaverShoppingSearchResponse> {
    // Rate limit check (25,000 requests/day)
    this.checkRateLimit();

    const url = new URL(this.config.apiUrl || 'https://openapi.naver.com/v1/search/shop.json');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': this.config.clientId,
          'X-Naver-Client-Secret': this.config.clientSecret,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.errorMessage || `HTTP error! status: ${response.status}`
        ) as NaverApiError;
        error.errorCode = errorData.errorCode || 'UNKNOWN';
        error.errorMessage = errorData.errorMessage || 'Unknown API error';
        error.statusCode = response.status;
        throw error;
      }

      const data: NaverShoppingSearchResponse = await response.json();
      this.incrementRequestCount();

      return data;
    } catch (error) {
      if ((error as NaverApiError).errorCode) {
        throw error;
      }
      const apiError = new Error(
        error instanceof Error ? error.message : 'Network error'
      ) as NaverApiError;
      apiError.errorCode = 'NETWORK_ERROR';
      apiError.errorMessage = error instanceof Error ? error.message : 'Network error';
      apiError.statusCode = -1;
      throw apiError;
    }
  }

  /**
   * Check rate limit (25,000 requests/day)
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

    if (this.requestCount >= 25000) {
      throw new Error('Naver API daily rate limit exceeded (25,000 requests/day)');
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
      display?: number; // 결과 개수 (1-100, 기본 10)
      start?: number; // 시작 위치 (1-1000, 기본 1)
      sort?: 'sim' | 'date' | 'asc' | 'dsc'; // 정렬 (sim: 유사도, date: 날짜, asc: 가격낮은순, dsc: 가격높은순)
    } = {}
  ): Promise<NaverProductSummary> {
    const {
      display = 20,
      start = 1,
      sort = 'sim',
    } = options;

    const response = await this.request('shop.json', {
      query,
      display,
      start,
      sort,
    });

    // Calculate price statistics
    const prices = response.items
      .map((item) => parseInt(item.lprice))
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
      products: response.items,
      statistics,
      total: response.total,
    };
  }

  /**
   * Get product by barcode
   * @param barcode - Product barcode
   */
  async getProductByBarcode(barcode: string): Promise<NaverProductSummary | null> {
    try {
      // Search by barcode
      const result = await this.searchProducts(barcode, {
        display: 10,
        sort: 'sim', // 유사도순으로 검색
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

  /**
   * Strip HTML tags from title
   */
  stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Create a new Naver Shopping client instance
 */
export function createNaverShoppingClient(config?: NaverConfig): NaverShoppingClient {
  return new NaverShoppingClient(config);
}
