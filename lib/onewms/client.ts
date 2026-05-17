/**
 * ONEWMS-FMS API Client
 * API Documentation: https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f
 */

import {
  OnewmsConfig,
  OnewmsApiRequest,
  OnewmsApiResponse,
  OnewmsApiError,
  // Order
  OrderInfo,
  CreateOrderRequest,
  SetTransportNumberRequest,
  SetTransportPosRequest,
  CancelTransportPosRequest,
  TransportInvoiceRequest,
  SetOrderLabelRequest,
  // Product
  ProductInfo,
  CodeMatchInfo,
  AddProductRequest,
  // Stock
  StockInfoType,
  StockInfoResponse,
  StockTransactionInfo,
  StockTransactionDetailInfo,
  // Sheet
  SheetInfo,
  AddSheetRequest,
  // Onedas
  OnedasPackingInfo,
  OnedasPackingDetailInfo,
  // Etc
  EtcInfo,
  EtcSearchType,
  StockJobTypeInfo,
} from './types';
import { getOnewmsConfig } from './config';

export class OnewmsClient {
  private config: OnewmsConfig;

  constructor(config?: OnewmsConfig) {
    this.config = config || getOnewmsConfig();
  }

  /**
   * Make API request (standard {error, msg, data} wrapper)
   */
  private async request<T>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<OnewmsApiResponse<T>> {
    const requestBody: OnewmsApiRequest = {
      partner_key: this.config.partnerKey,
      domain_key: this.config.domainKey,
      action,
      ...params,
    };

    const apiUrl = this.config.apiUrl || 'https://api.onewms.co.kr/api.php';

    try {
      // Build form-encoded body (ONEWMS PHP API requires x-www-form-urlencoded)
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(requestBody)) {
        if (value !== undefined && value !== null) {
          formData.append(
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          );
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OnewmsApiResponse<T> = await response.json();

      // Check for API error (response uses "error" field, not "code")
      if (data.error !== 0) {
        throw new OnewmsApiError(
          data.error,
          data.msg || 'Unknown API error',
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof OnewmsApiError) {
        throw error;
      }
      throw new OnewmsApiError(
        -1,
        error instanceof Error ? error.message : 'Network error',
        undefined
      );
    }
  }

  /**
   * Make API request for endpoints that return raw data without {error, msg, data} wrapper.
   * e.g. get_stock_tx_info returns nested JSON directly.
   */
  private async requestRaw<T>(
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const requestBody: OnewmsApiRequest = {
      partner_key: this.config.partnerKey,
      domain_key: this.config.domainKey,
      action,
      ...params,
    };

    const apiUrl = this.config.apiUrl || 'https://api.onewms.co.kr/api.php';

    try {
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(requestBody)) {
        if (value !== undefined && value !== null) {
          formData.append(
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          );
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // If the response happens to have the standard wrapper, check for errors
      if (typeof data === 'object' && data !== null && 'error' in data && data.error !== 0) {
        throw new OnewmsApiError(
          data.error,
          data.msg || 'Unknown API error',
          data
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof OnewmsApiError) {
        throw error;
      }
      throw new OnewmsApiError(
        -1,
        error instanceof Error ? error.message : 'Network error',
        undefined
      );
    }
  }

  // ============================================
  // Order APIs
  // ============================================

  /**
   * Get order information.
   * Required: date_type, start_date, end_date.
   * Optional filters: order_id, trans_no, seq (NOT order_no — unsupported by API).
   * @deprecated order_no parameter removed — use order_id, trans_no, or seq instead
   */
  async getOrderInfo(params: {
    date_type: string;      // order_date, trans_date, collect_date, ready_date, trans_date_pos, cancel_date, change_date, cs_date
    start_date: string;     // YYYY-MM-DD
    end_date: string;       // YYYY-MM-DD
    status?: string;        // 주문상태 필터
    order_cs?: string;      // CS상태 필터
    hold?: string;          // 보류상태 필터
    order_id?: string;      // 주문번호 (주문 고유 ID)
    trans_no?: string;      // 송장번호 (배송번호로 조회)
    product_id?: string;    // 상품코드
    seq?: string;           // 관리번호 (set_trans_no 응답의 seq 사용)
    shop_id?: string;       // 판매처코드
    sub_domain_seq?: string; // 화주번호 (get_etc_info warehouse의 seq)
    packing_type?: string;  // single_qty, multi_qty, single_product, multi_product, single_product_multi_qty
    page?: number;
    limit?: number;         // 10, 30, 50, 100, 300, 500, 1000
  }): Promise<OrderInfo[]> {
    const response = await this.request<OrderInfo[]>('get_order_info', params);
    return response.data || [];
  }

  /**
   * Create order (set_orders)
   *
   * Request structure:
   * - shop_id: 판매처코드 (query param)
   * - collect_date?: 발주일 (query param, optional)
   * - rows: CreateOrderRow[] (JSON array — form-encoded as "data" or "rows")
   *
   * ⚠️ NOTE: 정확한 JSON 배열 키명(data/rows/orders) 및 form-encoding 방식은
   *           ONEWMS API 스펙 확인 후 조정이 필요합니다.
   *           현재 가정: rows 배열을 "data" 키로 form-encoded 전송
   *
   * @param req - Order request with shop_id, collect_date, and rows
   */
  async createOrder(req: CreateOrderRequest): Promise<void> {
    // Transform CreateOrderRequest to match form-encoded expected by ONEWMS
    // The request() method will JSON.stringify the rows array
    await this.request('set_orders', {
      shop_id: req.shop_id,
      ...(req.collect_date && { collect_date: req.collect_date }),
      data: req.rows, // ⚠️ Assuming "data" key — verify with ONEWMS
    });
  }

  /**
   * Set transport number
   * @param data - Transport number data
   */
  async setTransportNumber(data: SetTransportNumberRequest): Promise<void> {
    await this.request('set_trans_no', data);
  }

  /**
   * Set transport position (배송처리)
   * @param data - Transport position data
   */
  async setTransportPos(data: SetTransportPosRequest): Promise<void> {
    await this.request('set_trans_pos', data);
  }

  /**
   * Cancel transport position
   * @param data - Cancel transport data
   */
  async cancelTransportPos(data: CancelTransportPosRequest): Promise<void> {
    await this.request('cancel_trans_pos', data);
  }

  /**
   * Get transport invoice image
   * @param transNo - Transport number
   */
  async getTransportInvoice(transNo: string): Promise<string> {
    const response = await this.request<{ invoice_url: string }>(
      'get_trans_invoice',
      { trans_no: transNo }
    );
    return response.data?.invoice_url || '';
  }

  /**
   * Set order label
   * @param data - Order label data
   */
  async setOrderLabel(data: SetOrderLabelRequest): Promise<void> {
    await this.request('set_order_label', data);
  }

  // ============================================
  // Product APIs
  // ============================================

  /**
   * Get product list (paginated)
   * Note: product_code param is not supported by API, use page/limit
   */
  async getProductList(page = 1, limit = 100): Promise<{
    data: ProductInfo[];
    total: number;
  }> {
    const response = await this.request<ProductInfo[]>('get_product_info', {
      page,
      limit,
    });
    return {
      data: response.data || [],
      total: response.total || 0,
    };
  }

  /**
   * Get code match information
   * @deprecated API returns "invalid action" as of 2026-04-21. Awaiting ONEWMS clarification.
   */
  async getCodeMatch(internalCode: string): Promise<CodeMatchInfo> {
    console.warn('[ONEWMS] getCodeMatch: API returns "invalid action". Contact ONEWMS team.');
    return {};
  }

  /**
   * Add product
   * @param product - Product data
   */
  async addProduct(product: AddProductRequest): Promise<void> {
    await this.request('add_product', product);
  }

  // ============================================
  // Stock APIs
  // ============================================

  /**
   * Get stock information.
   * @param type - Query type: product_id, link_id, barcode, supply_code
   * @param ids - Search value (required). e.g. product_id, barcode value, supply_code
   * @param params - Optional: warehouse_seq, stock_type, include_ready_trans
   *
   * Response structure: { [product_id]: { product_id, link_id, barcode, stock: { [warehouse_seq]: { warehouse_seq, stock } } } }
   * For type=supply_code, response includes total/page/limit pagination fields.
   */
  async getStockInfo(
    type: StockInfoType,
    ids: string,
    params?: { warehouse_seq?: string; stock_type?: string; include_ready_trans?: string; page?: number; limit?: number }
  ): Promise<StockInfoResponse> {
    const response = await this.request<StockInfoResponse>('get_stock_info', {
      type,
      ids,
      ...params,
    });
    return response.data || {};
  }

  /**
   * Get stock transaction summary (nested structure)
   * NOTE: This API returns raw nested JSON without the standard {error, msg, data} wrapper.
   * Response: { [product_id]: { [warehouse_seq]: StockTransactionEntry[][] } }
   */
  async getStockTxInfo(
    page = 1,
    limit = 100
  ): Promise<StockTransactionInfo> {
    return this.requestRaw<StockTransactionInfo>(
      'get_stock_tx_info',
      { page, limit }
    );
  }

  /**
   * Get stock transaction detail (flat list with per-entry info)
   */
  async getStockTxDetailInfo(
    page = 1,
    limit = 100
  ): Promise<StockTransactionDetailInfo[]> {
    const response = await this.request<StockTransactionDetailInfo[]>(
      'get_stock_tx_detail_info',
      { page, limit }
    );
    return response.data || [];
  }

  // ============================================
  // Sheet APIs
  // ============================================

  /**
   * Get sheet list
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   */
  async getSheetList(
    startDate?: string,
    endDate?: string
  ): Promise<SheetInfo[]> {
    const response = await this.request<SheetInfo[]>('get_sheet_list', {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data || [];
  }

  /**
   * Add sheet
   * @param sheet - Sheet data
   */
  async addSheet(sheet: AddSheetRequest): Promise<void> {
    await this.request('add_sheet', sheet);
  }

  // ============================================
  // Onedas APIs
  // ============================================

  /**
   * Get Onedas packing number
   * @param orderNo - Order number
   */
  async getOnedasPackingNo(orderNo: string): Promise<OnedasPackingInfo> {
    const response = await this.request<OnedasPackingInfo>(
      'get_onedas_packing_no',
      { order_no: orderNo }
    );
    return response.data || {};
  }

  /**
   * Get Onedas packing number detail
   * @param packingNo - Packing number
   */
  async getOnedasPackingNoDetail(
    packingNo: string
  ): Promise<OnedasPackingDetailInfo> {
    const response = await this.request<OnedasPackingDetailInfo>(
      'get_onedas_packing_no_detail',
      { packing_no: packingNo }
    );
    return response.data || {};
  }

  // ============================================
  // Etc APIs
  // ============================================

  /**
   * Get etc information (reference data).
   * Note: Do NOT pass 'job_type' here — use getStockJobTypes() instead,
   * because job_type returns an object, not an array.
   */
  async getEtcInfo(searchType: Exclude<EtcSearchType, 'job_type'>): Promise<EtcInfo[]> {
    const response = await this.request<EtcInfo[]>('get_etc_info', {
      search_type: searchType,
    });
    return response.data || [];
  }

  /**
   * Get stock job types (재고작업타입).
   * Returns: {in: {code, name}, out: {code, name}, trans: {code, name}, shift: {code, name}, arrange: {code, name}}
   */
  async getStockJobTypes(): Promise<StockJobTypeInfo> {
    const response = await this.request<StockJobTypeInfo>('get_etc_info', {
      search_type: 'job_type',
    });
    return response.data || {};
  }
}

/**
 * Create a new ONEWMS client instance
 */
export function createOnewmsClient(config?: OnewmsConfig): OnewmsClient {
  return new OnewmsClient(config);
}
