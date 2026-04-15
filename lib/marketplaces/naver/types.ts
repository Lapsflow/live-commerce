/**
 * Naver Shopping API Types
 * API Documentation: https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md
 */

export interface NaverConfig {
  clientId: string;
  clientSecret: string;
  apiUrl?: string;
}

export interface NaverShoppingProduct {
  title: string; // HTML 태그 포함된 제목
  link: string; // 상품 URL
  image: string; // 이미지 URL
  lprice: string; // 최저가 (문자열)
  hprice: string; // 최고가 (문자열)
  mallName: string; // 쇼핑몰명
  productId: string; // 상품 ID
  productType: string; // 상품군 (1: 일반, 2: 중고, 3: 단종, 4: 판매예정)
  brand: string; // 브랜드
  maker: string; // 제조사
  category1: string; // 대분류 카테고리
  category2: string; // 중분류 카테고리
  category3: string; // 소분류 카테고리
  category4: string; // 세분류 카테고리
}

export interface NaverShoppingSearchResponse {
  lastBuildDate: string; // 검색 결과를 생성한 시간
  total: number; // 총 검색 결과 개수
  start: number; // 검색 시작 위치
  display: number; // 한 번에 표시할 검색 결과 개수
  items: NaverShoppingProduct[];
}

export interface NaverApiError extends Error {
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

export interface NaverProductSummary {
  products: NaverShoppingProduct[];
  statistics: PriceStatistics;
  total: number;
}
