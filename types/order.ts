import type { User } from "./user";

export type OrderStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PaymentStatus = "UNPAID" | "PAID";
export type ShippingStatus = "PENDING" | "PREPARING" | "SHIPPED" | "PARTIAL";

// Phase 2: Updated OrderItem type with product details and margin fields
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    productType: "HEADQUARTERS" | "CENTER"; // Added
  };
  quantity: number;
  barcode: string; // Added
  productName: string; // Added
  supplyPrice: number; // Added
  totalSupply: number; // Added
  margin: number; // Added
  productType: "HEADQUARTERS" | "CENTER"; // Added
  unitPrice: number;
  totalPrice: number;
  createdAt: string; // Changed: string for API responses
}

// Phase 2: Updated Order type with product type, virtual account, and shipping fields
export interface Order {
  id: string;
  orderNo: string;
  sellerId: string;
  seller?: {
    id: string;
    name: string;
    email: string;
  };
  adminId: string | null;
  status: OrderStatus;
  productType: "HEADQUARTERS" | "CENTER"; // Added
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  totalAmount: number;
  totalMargin: number; // Added
  memo: string | null;
  recipient?: string | null; // Added
  phone?: string | null; // Added
  address?: string | null; // Added
  virtualAccountNumber?: string | null; // Added
  virtualAccountBank?: string | null; // Added
  virtualAccountDueDate?: string | null; // Added
  uploadedAt: string; // Changed: string for API responses
  approvedAt: string | null; // Changed: string for API responses
  createdAt: string; // Changed: string for API responses
  updatedAt: string; // Changed: string for API responses
  // ✨ 재고 선점 자동화 (PDF 스펙 7페이지)
  expiresAt?: string | null; // 입금 마감 시각
  cancelledAt?: string | null; // 취소 시각
  cancelReason?: string | null; // EXPIRED | SELLER_CANCELLED | ADMIN_CANCELLED
  paidAt?: string | null; // 입금 완료 시각
  items?: OrderItem[];
}

export type OrderFormData = {
  sellerId: string;
  memo?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
};
