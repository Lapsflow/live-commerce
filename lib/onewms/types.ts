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
  error: number;
  msg: string;
  data?: T;
  total?: number;
  page?: number | string;
  limit?: number | string;
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
  pack?: string;
  seq?: string;
  status?: string;          // "1"=접수, "7"=승장, "8"=배송
  order_cs?: string;        // CS상태: "0"=정상, "1"~"8" (CsStatus enum)
  hold?: string;            // 보류상태: "0"=정상, "1"~"6" (HoldStatus enum)
  shop_id?: string;
  order_id?: string;
  order_id_seq?: string;
  order_id_seq2?: string;
  order_no?: string;
  order_type?: string;
  order_type2?: string;
  shop_product_id?: string;
  product_name?: string;
  options?: string;
  qty?: string;
  order_name?: string;
  order_mobile?: string;
  order_tel?: string;
  recv_name?: string;
  recv_mobile?: string;
  recv_tel?: string;
  recv_address?: string;
  recv_zip?: string;
  memo?: string;
  prepay_price?: string;
  trans_corp?: string;
  trans_no?: string;
  trans_who?: string;
  order_date?: string;
  collect_date?: string;
  ready_date?: string;
  trans_date?: string;
  trans_date_pos?: string;
  trans_due_date?: string;
  amount?: string;
  supply_price?: string;
  extra_money?: string;
  pay_type?: string;
  sub_domain_seq?: string;
  order_products?: Array<{
    seq: string;
    order_cs: string;
    product_id: string;
    link_id: string;
    qty: string;
    supply_code: string;
    prd_amount: string;
    prd_supply_price: string;
    extra_money: string;
    is_gift: string;
    cancel_date: string;
    change_date: string;
  }>;
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
  product_id?: string;
  name?: string;
  supply_code?: string;
  brand?: string;
  origin?: string;
  weight?: string;
  org_price?: string;
  shop_price?: string;
  supply_price?: string;
  barcode?: string;
  img_500?: string;
  location?: string;
  memo?: string;
  category?: string | null;
  maker?: string;
  reg_date?: string;
  last_update_date?: string;
  options?: string;
  enable_sale?: string;
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

/** Valid type values for get_stock_info API */
export type StockInfoType = 'product_id' | 'link_id' | 'barcode' | 'supply_code';

/** Per-warehouse stock entry */
export interface StockWarehouseEntry {
  warehouse_seq?: string;
  stock?: string | number;
  [key: string]: unknown;
}

/** Per-product stock entry returned by get_stock_info */
export interface StockProductEntry {
  product_id?: string;
  link_id?: string;
  barcode?: string;
  supply_code?: string;
  stock?: Record<string, StockWarehouseEntry>;
  [key: string]: unknown;
}

/**
 * get_stock_info response: nested structure keyed by product_id.
 * Response wrapped in standard {error, msg, data} but data is:
 * { [product_id]: StockProductEntry }
 *
 * For type=supply_code, response includes total/page/limit pagination.
 */
export type StockInfoResponse = Record<string, StockProductEntry>;

/** @deprecated Use StockProductEntry instead */
export interface StockInfo {
  product_code?: string;
  available_qty?: number;
  total_qty?: number;
  [key: string]: unknown;
}

/** Individual stock transaction entry */
export interface StockTransactionEntry {
  job?: string;        // "in"=입고, "stock"=재고, "trans"=출고
  job_type?: string;
  qty?: string;
}

/**
 * get_stock_tx_info response: nested structure
 * { [product_id]: { [warehouse_seq]: StockTransactionEntry[][] } }
 */
export type StockTransactionInfo = Record<
  string,
  Record<string, StockTransactionEntry[][]>
>;

export interface StockTransactionDetailInfo {
  seq?: string;
  crdate?: string;
  product_id?: string;
  warehouse_seq?: string;
  stock_type?: string;
  job?: string;           // "trans"=출고, "in"=입고
  job_type?: string;
  qty?: string;
  stock?: string;         // 변동 후 잔여 재고
  order_seq?: string;
  worker?: string;
  memo?: string;
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
  code?: string;
  seq?: string;   // warehouse search_type returns {seq, name} instead of {code, name}
  name?: string;
  [key: string]: unknown;
}

/** job_type returns a nested object, not an array */
export interface StockJobTypeInfo {
  in?: { code: string; name: string };
  out?: { code: string; name: string };
  trans?: { code: string; name: string };
  shift?: { code: string; name: string };
  arrange?: { code: string; name: string };
  [key: string]: { code: string; name: string } | undefined;
}

/**
 * get_etc_info search_type valid values.
 * Note: job_type returns StockJobTypeInfo (object), not EtcInfo[] (array).
 */
export type EtcSearchType = 'shop' | 'supply' | 'trans' | 'warehouse' | 'stock_type' | 'category' | 'job_type';

// ============================================
// Error Types
// ============================================

export class OnewmsApiError extends Error {
  constructor(
    public errorCode: number,
    message: string,
    public response?: OnewmsApiResponse
  ) {
    super(message);
    this.name = 'OnewmsApiError';
  }
}
