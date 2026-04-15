/**
 * Coupang Partners API Types
 * API Documentation: https://developers.coupangcorp.com/
 */

export interface CoupangConfig {
  accessKey: string;
  secretKey: string;
  apiUrl?: string;
}

export interface CoupangProduct {
  productId: number;
  productName: string;
  productUrl: string;
  productImage: string;
  productPrice: number; // 판매가
  originalPrice: number; // 정가
  discountRate: number; // 할인율
  isRocket: boolean; // 로켓배송 여부
  isFreeShipping: boolean; // 무료배송 여부
  categoryName: string; // 카테고리명
  vendorItemId?: string; // 판매자 상품 ID
  salesCount?: number; // 판매량 (30일)
  reviewCount?: number; // 리뷰 개수
  rating?: number; // 평점
}

export interface CoupangSearchResponse {
  rCode: string; // 응답 코드
  rMessage: string; // 응답 메시지
  data: {
    productData: CoupangProduct[];
  };
}

export interface CoupangApiError extends Error {
  errorCode: string;
  errorMessage: string;
  statusCode: number;
}

export interface PriceStatistics {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  count: number;
}

export interface CoupangProductSummary {
  products: CoupangProduct[];
  statistics: PriceStatistics;
  total: number;
}
