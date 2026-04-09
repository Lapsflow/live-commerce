/**
 * ONEWMS-FMS API Types
 * API Documentation: https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f
 */

// ============================================
// Base Types
// ============================================

export interface OnewmsConfig {
  partnerKey: string;
  domainKey: string;
  apiUrl?: string;
}

export interface OnewmsApiRequest {
  partner_key: string;
  domain_key: string;
  action: string;
  [key: string]: unknown;
}

export interface OnewmsApiResponse<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

// ============================================
// Status Enums
// ============================================

/** 주문상태 */
export enum OrderStatus {
  /** 접수 */
  RECEIVED = 1,
  /** 승장 */
  APPROVED = 7,
  /** 배송 */
  SHIPPED = 8,
}

/** CS상태 */
export enum CsStatus {
  /** 정상 */
  NORMAL = 0,
  /** 배송전 전체 취소 */
  PRE_DELIVERY_FULL_CANCEL = 1,
  /** 배송전 부분 취소 */
  PRE_DELIVERY_PARTIAL_CANCEL = 2,
  /** 배송후 전체 취소 */
  POST_DELIVERY_FULL_CANCEL = 3,
  /** 배송후 부분 취소 */
  POST_DELIVERY_PARTIAL_CANCEL = 4,
  /** 배송전 전체 교환 */
  PRE_DELIVERY_FULL_EXCHANGE = 5,
  /** 배송전 부분 교환 */
  PRE_DELIVERY_PARTIAL_EXCHANGE = 6,
  /** 배송후 전체 교환 */
  POST_DELIVERY_FULL_EXCHANGE = 7,
  /** 배송후 부분 교환 */
  POST_DELIVERY_PARTIAL_EXCHANGE = 8,
}

/** 보류상태 */
export enum HoldStatus {
  /** 정상 */
  NORMAL = 0,
  /** 일반 */
  GENERAL = 1,
  /** 주소변경 */
  ADDRESS_CHANGE = 2,
  /** 교환 */
  EXCHANGE = 3,
  /** 전체취소 */
  FULL_CANCEL = 4,
  /** 부분취소 */
  PARTIAL_CANCEL = 5,
  /** 합포변경 */
  MERGE_CHANGE = 6,
}

// ============================================
// Order Types
// ============================================

export interface OrderInfo {
  order_no?: string;
  order_date?: string;
  order_status?: OrderStatus;
  cs_status?: CsStatus;
  hold_status?: HoldStatus;
  trans_no?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  [key: string]: unknown;
}

export interface CreateOrderRequest {
  order_no: string;
  order_date: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  products: Array<{
    product_code: string;
    quantity: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface SetTransportNumberRequest {
  order_no: string;
  trans_no: string;
  [key: string]: unknown;
}

export interface SetTransportPosRequest {
  order_no: string;
  [key: string]: unknown;
}

export interface CancelTransportPosRequest {
  order_no: string;
  [key: string]: unknown;
}

export interface TransportInvoiceRequest {
  trans_no: string;
  [key: string]: unknown;
}

export interface SetOrderLabelRequest {
  order_no: string;
  label: string;
  [key: string]: unknown;
}

// ============================================
// Product Types
// ============================================

export interface ProductInfo {
  product_code?: string;
  product_name?: string;
  barcode?: string;
  [key: string]: unknown;
}

export interface CodeMatchInfo {
  internal_code?: string;
  external_code?: string;
  [key: string]: unknown;
}

export interface AddProductRequest {
  product_code: string;
  product_name: string;
  barcode?: string;
  [key: string]: unknown;
}

// ============================================
// Stock Types
// ============================================

export interface StockInfo {
  product_code?: string;
  available_qty?: number;
  total_qty?: number;
  [key: string]: unknown;
}

export interface StockTransactionInfo {
  product_code?: string;
  trans_type?: string;
  trans_qty?: number;
  trans_date?: string;
  [key: string]: unknown;
}

export interface StockTransactionDetailInfo {
  product_code?: string;
  trans_type?: string;
  trans_qty?: number;
  trans_date?: string;
  before_qty?: number;
  after_qty?: number;
  [key: string]: unknown;
}

// ============================================
// Sheet Types
// ============================================

export interface SheetInfo {
  sheet_no?: string;
  sheet_type?: string;
  sheet_date?: string;
  [key: string]: unknown;
}

export interface AddSheetRequest {
  sheet_type: string;
  sheet_date: string;
  products: Array<{
    product_code: string;
    quantity: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ============================================
// Onedas Types
// ============================================

export interface OnedasPackingInfo {
  packing_no?: string;
  order_no?: string;
  [key: string]: unknown;
}

export interface OnedasPackingDetailInfo {
  packing_no?: string;
  order_no?: string;
  products?: Array<{
    product_code: string;
    quantity: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ============================================
// Etc Types
// ============================================

export interface EtcInfo {
  [key: string]: unknown;
}

// ============================================
// Error Types
// ============================================

export class OnewmsApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public response?: OnewmsApiResponse
  ) {
    super(message);
    this.name = 'OnewmsApiError';
  }
}
