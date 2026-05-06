/**
 * 발주 상태 한글 매핑 유틸
 *
 * DB의 OrderStatus + PaymentStatus + ShippingStatus 조합을
 * 사용자에게 보여줄 한글 라벨로 변환합니다.
 */

type OrderStatusType = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type PaymentStatusType = "UNPAID" | "PAID" | "PAYMENT_FAILED";
type ShippingStatusType = "PENDING" | "PREPARING" | "SHIPPED" | "PARTIAL";

export interface OrderStatusCombo {
  status: OrderStatusType;
  paymentStatus: PaymentStatusType;
  shippingStatus: ShippingStatusType;
}

export function getOrderStatusLabel(combo: OrderStatusCombo): string {
  const { status, paymentStatus, shippingStatus } = combo;

  if (status === "CANCELLED") return "취소";
  if (status === "REJECTED") return "반려";

  if (status === "PENDING") return "컨펌대기";

  // APPROVED
  if (paymentStatus === "PAYMENT_FAILED") return "입금실패";
  if (paymentStatus === "UNPAID") return "입금대기";

  // APPROVED + PAID
  if (shippingStatus === "SHIPPED") return "출고완료";
  if (shippingStatus === "PARTIAL") return "부분출고";
  if (shippingStatus === "PREPARING") return "출고준비중";

  return "입금완료(출고대기)";
}

export type OrderStatusLabelType =
  | "컨펌대기"
  | "입금대기"
  | "입금완료(출고대기)"
  | "출고준비중"
  | "부분출고"
  | "출고완료"
  | "반려"
  | "취소"
  | "입금실패";

const statusColorMap: Record<OrderStatusLabelType, string> = {
  "컨펌대기": "bg-yellow-100 text-yellow-800",
  "입금대기": "bg-blue-100 text-blue-800",
  "입금완료(출고대기)": "bg-green-100 text-green-800",
  "출고준비중": "bg-indigo-100 text-indigo-800",
  "부분출고": "bg-orange-100 text-orange-800",
  "출고완료": "bg-gray-100 text-gray-800",
  "반려": "bg-red-100 text-red-800",
  "취소": "bg-gray-200 text-gray-600",
  "입금실패": "bg-red-100 text-red-800",
};

export function getOrderStatusColor(label: string): string {
  return statusColorMap[label as OrderStatusLabelType] || "bg-gray-100 text-gray-800";
}
