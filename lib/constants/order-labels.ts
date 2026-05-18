import type { PaymentStatus, ShippingStatus } from "@/types/order";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "입금확인전",
  PENDING_CONFIRMATION: "입금확인중",
  PAID: "입금완료",
  PAYMENT_FAILED: "결제실패",
};

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  PENDING: "배송대기",
  PREPARING: "배송준비중",
  SHIPPED: "배송중",
  DELIVERED: "배송완료",
  PARTIAL: "부분배송",
};

export const paymentStatusVariant = (
  status: PaymentStatus
): "default" | "secondary" | "destructive" => {
  switch (status) {
    case "PAID":
      return "default";
    case "PENDING_CONFIRMATION":
      return "secondary";
    case "UNPAID":
    case "PAYMENT_FAILED":
      return "destructive";
    default:
      return "default";
  }
};

export const shippingStatusVariant = (
  status: ShippingStatus
): "default" | "secondary" | "destructive" => {
  switch (status) {
    case "DELIVERED":
      return "default";
    case "SHIPPED":
    case "PREPARING":
      return "secondary";
    case "PENDING":
    case "PARTIAL":
      return "destructive";
    default:
      return "default";
  }
};
