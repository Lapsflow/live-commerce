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
  shopId?: string;           // P0: 판매처코드 (set_orders 필수 파라미터)
  subDomainSeq?: string;     // 화주번호 (get_order_info 필수). 운영 검증으로 한국무진유통 = "62" 확정. 미설정 시 "invalid sub_domain_seq" 에러.
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

/** P0: set_orders API — 각 OrderItem마다 1 row (배열 요소) */
export interface CreateOrderRow {
  // 필수 필드
  order_id: string;             // 주문번호 (Order.onewmsOrderNo)
  shop_product_id: string;      // 판매처상품코드 (OrderItem.product.onewmsCode)
  qty: number;                  // 주문수량
  recv_name: string;            // 수령자명 (Order.recipient, null guard 필수)

  // 필수 또는 권장 필드
  recv_mobile?: string;         // 수령자핸드폰 (Order.phone)
  recv_address?: string;        // 수령자주소 (Order.address)

  // 선택 필드
  order_id_seq?: string;        // 주문상세번호
  order_id_seq2?: string;       // 주문상세번호2
  order_type?: string;          // 주문구분
  order_type2?: string;         // 주문구분2
  product_name?: string;        // 판매처상품명
  options?: string;             // 판매처옵션
  trans_who?: string;           // 선착불 ("선불"|"착불")
  order_date?: string;          // 주문일자 (ISO date)
  order_time?: string;          // 주문일시 (HH:mm:ss)
  order_name?: string;          // 주문자명
  order_tel?: string;           // 주문자연락처
  order_mobile?: string;        // 주문자핸드폰
  order_email?: string;         // 주문자이메일
  order_zip?: string;           // 주문자우편번호
  order_address?: string;       // 주문자주소
  recv_email?: string;          // 수령자이메일
  recv_tel?: string;            // 수령자연락처
  recv_zip?: string;            // 수령자우편번호
  memo?: string;                // 배송메모 (Order.memo)
  cust_id?: string;             // 고객ID
  trans_due_date?: string;      // 배송예정일
  [key: string]: unknown;
}

/** P0: set_orders API request (query params + JSON array) */
export interface CreateOrderRequest {
  // Query parameters (client.ts에서 처리)
  shop_id: string;              // 판매처코드 (필수, 사용자정의판매처만가능)
  collect_date?: string;        // 발주일 (YY-MM-DD, 기본값: 현재일자)

  // JSON body (POST로 전송할 행 배열)
  rows: CreateOrderRow[];        // 각 주문 행 (주문 1건 = 상품 1개당 row 1개)
}

/** P0: set_trans_no API — 송장번호 입력 */
export interface SetTransportNumberRequest {
  seq: string;                  // 관리번호 (get_order_info 응답의 seq) — 필수
  trans_no: string;             // 송장번호 — 필수
  trans_corp: string;           // 택배사 — 필수 (ONEWMS API 문서 확인: 기타정보조회에서 조회)
  trans_pos?: 0 | 1;            // 송장위치 — 선택
  type?: 0 | 1 | 2;             // 타입 — 선택
  [key: string]: unknown;
}

/** P1: set_trans_pos API — 송장 위치 설정 */
export interface SetTransportPosRequest {
  trans_no: string;             // 송장번호 — 필수 (변경: order_no → trans_no)
  [key: string]: unknown;
}

/** P1: cancel_trans_pos API — 송장 위치 취소 */
export interface CancelTransportPosRequest {
  trans_no: string;             // 송장번호 — 필수 (변경: order_no → trans_no)
  [key: string]: unknown;
}

export interface TransportInvoiceRequest {
  trans_no: string;
  [key: string]: unknown;
}

/** P1: set_order_label API — 주문라벨 설정 */
export interface SetOrderLabelRequest {
  seq: string;                  // 관리번호 — 필수 (변경: order_no → seq)
  label_name: string;           // 라벨명 — 필수 (변경: label → label_name)
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
  // 필수
  name: string;                 // 상품명 (필수)

  // 강권
  supply_code?: string;         // 공급코드

  // 선택
  barcode?: string;             // 바코드
  link_id?: string;             // 링크코드
  origin?: string;              // 원산지
  maker?: string;               // 제조사
  brand?: string;               // 브랜드
  org_price?: number;           // 원가
  supply_price?: number;        // 공급가
  shop_price?: number;          // 판매가
  market_price?: number;        // 시장가
  stock_manage?: '0' | '1';     // 재고관리 여부 ('0'=미관리, '1'=관리)
  options?: string;             // 옵션

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
  /**
   * 운영 검증 v8 (2026-05-25) 확정:
   * include_ready_trans=1 옵션 전송 시 ONEWMS 응답에 포함되는 "접수/송장 발급된 미출고 재고"
   * 가용재고 = stock(총재고) - ready_trans_stock
   * ONEWMS 운영 UI 가 표시하는 값과 일치 (실제 셀러가 추가로 판매 가능한 수량)
   */
  ready_trans_stock?: string;
  check_date?: string;
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
  sheet_seq?: string;      // 전표 시퀀스
  sheet_type?: string;
  sheet_date?: string;
  sheet_name?: string;     // 전표 이름
  status?: string;         // 상태 코드 (0=요청, 1=작업중, 2=완료, 3=삭제)
  warehouse_seq?: string;  // 창고 시퀀스
  created_at?: string;     // 생성 일시
  [key: string]: unknown;
}

export interface AddSheetRequest {
  // 필수
  sheet_type: 'STOCK_IN_SHEET' | 'STOCK_OUT_SHEET' | 'STOCK_ARRANGE_SHEET' | 'STOCK_SHIFT_SHEET';

  // 강권 (대부분 필수)
  sheet_name?: string;           // 시트 이름
  warehouse_seq?: string;        // 창고 시퀀스
  stock_type_seq?: string;       // 재고타입 시퀀스
  job_type_seq?: string;         // 작업타입 시퀀스

  // 선택
  supply_code?: string;          // 공급코드
  partner_code?: string;         // 파트너코드
  sub_domain_seq?: string;       // 서브도메인
  warehouse_shift_seq?: string;  // 창고이동 시퀀스 (STOCK_SHIFT_SHEET 용)
  stock_type_shift_seq?: string; // 재고타입이동 시퀀스 (STOCK_SHIFT_SHEET 용)

  [key: string]: unknown;
}

export interface AddSheetItemsRequest {
  // 필수 (product_id 또는 link_id 중 하나)
  product_id?: string;           // 상품ID
  link_id?: string;              // 링크ID
  qty: number;                   // 수량 (필수)

  // 선택
  memo?: string;                 // 메모
  expire_date?: string;          // 유효기한
  lot_no?: string;               // 로트번호
  location?: string;             // 로케이션
  [key: string]: unknown;
}

// ============================================
// Onedas Types
// ============================================

export interface OnedasPackingInfo {
  picking_orders?: Array<{
    work_date: string;            // 작업일
    no: number | string;          // 피킹차수
    crdate?: string;              // 생성일시
    no_sub?: number | string;     // 총 패킹차수
    cnt?: number;                 // 총 송장수
    picking_unit?: number;        // 작업인원
    status?: number;              // 상태
    packing_orders?: Array<{
      work_date: string;
      no: number | string;
      no_sub: number | string;
      crdate?: string;
      cnt?: number;
      picking_unit?: number;
      status?: number;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface OnedasPackingDetailInfo {
  data?: Array<{
    multi_location?: string;      // 멀티로케이션 여부
    location?: string;            // 위치
    expire_date?: string;         // 유효기한
    lot_no?: string;              // 로트번호
    ma_date?: string;             // 제조일자
    product_id?: string;          // 상품ID
    name?: string;                // 상품명
    options?: string;             // 옵션
    no_sub?: number;              // 패킹차수
    no_sub_qty?: number;          // 패킹당 수량
    qty?: number;                 // 총 수량
    total_qty?: number;           // 총 수량
    order_id?: string;            // 주문번호
    trans_no?: string;            // 송장번호
    p_barcode?: string;           // 상품 바코드
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
