export interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  totalStock: number;
  stockMujin: number;
  stock1: number;
  stock2: number;
  stock3: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductFormData = Omit<Product, "id" | "createdAt" | "updatedAt" | "totalStock">;
