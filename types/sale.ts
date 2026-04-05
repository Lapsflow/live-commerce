import type { User } from "./user";
import type { Product } from "./product";
import type { Broadcast } from "./broadcast";

export interface Sale {
  id: string;
  saleNo: string;
  sellerId: string;
  seller?: User;
  productId: string;
  product?: Product;
  broadcastId: string | null;
  broadcast?: Broadcast | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleDate: Date;
  createdAt: Date;
}

export type SaleFormData = {
  sellerId: string;
  productId: string;
  broadcastId?: string;
  quantity: number;
  unitPrice: number;
};
