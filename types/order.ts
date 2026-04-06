import type { User } from "./user";

export type OrderStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PaymentStatus = "UNPAID" | "PAID";
export type ShippingStatus = "PENDING" | "PREPARING" | "SHIPPED" | "PARTIAL";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
}

export interface Order {
  id: string;
  orderNo: string;
  sellerId: string;
  seller?: User;
  adminId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  totalAmount: number;
  memo: string | null;
  uploadedAt: Date;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
