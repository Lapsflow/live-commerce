// Phase 2: Updated Product type with required productType enum and management fields
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
  productType: "HEADQUARTERS" | "CENTER"; // Changed: required enum
  managedBy: string | null; // Added: center ID for CENTER products
  isWmsProduct: boolean; // Added: true if HEADQUARTERS product
  createdAt: string; // Changed: string for API responses
  updatedAt: string; // Changed: string for API responses
}

export type ProductFormData = Omit<Product, "id" | "createdAt" | "updatedAt" | "totalStock">;
