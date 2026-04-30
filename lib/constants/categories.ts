/**
 * 상품 카테고리 목록
 */
export const PRODUCT_CATEGORIES = [
  '식품',
  '뷰티',
  '생활',
  '가전',
  '패션',
  '기타',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
