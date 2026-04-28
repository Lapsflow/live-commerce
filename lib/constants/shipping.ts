/**
 * 샘플 배송비 정책 (PROPOSAL-03)
 */
export const DEFAULT_SHIPPING_FEE = 3000; // 기본 배송비 3,000원
export const FREE_SHIPPING_THRESHOLD = 50000; // 5만원 이상 무료배송

export function calculateShippingFee(totalAmount: number): number {
  if (totalAmount <= 0) return 0;
  return totalAmount >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
}
