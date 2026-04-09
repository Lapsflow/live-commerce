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
  StockInfo,
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
} from './types';
import { getOnewmsConfig } from './config';

export class OnewmsClient {
  private config: OnewmsConfig;

  constructor(config?: OnewmsConfig) {
    this.config = config || getOnewmsConfig();
  }

  /**
   * Make API request
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
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OnewmsApiResponse<T> = await response.json();

      // Check for API error
      if (data.code !== 0) {
        throw new OnewmsApiError(
          data.code,
          data.message || 'Unknown API error',
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

  // ============================================
  // Order APIs
  // ============================================

  /**
   * Get order information
   * @param orderNo - Order number
   */
  async getOrderInfo(orderNo: string): Promise<OrderInfo> {
    const response = await this.request<OrderInfo>('get_order_info', {
      order_no: orderNo,
    });
    return response.data || {};
  }

  /**
   * Create order
   * @param order - Order data
   */
  async createOrder(order: CreateOrderRequest): Promise<void> {
    await this.request('set_orders', order);
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
   * Get product information
   * @param productCode - Product code
   */
  async getProductInfo(productCode: string): Promise<ProductInfo> {
    const response = await this.request<ProductInfo>('get_product_info', {
      product_code: productCode,
    });
    return response.data || {};
  }

  /**
   * Get code match information
   * @param internalCode - Internal code
   */
  async getCodeMatch(internalCode: string): Promise<CodeMatchInfo> {
    const response = await this.request<CodeMatchInfo>('get_code_match', {
      internal_code: internalCode,
    });
    return response.data || {};
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
   * Get current stock information
   * @param productCode - Product code
   */
  async getStockInfo(productCode: string): Promise<StockInfo> {
    const response = await this.request<StockInfo>('get_stock_info', {
      product_code: productCode,
    });
    return response.data || {};
  }

  /**
   * Get stock transaction information
   * @param productCode - Product code
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   */
  async getStockTxInfo(
    productCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<StockTransactionInfo[]> {
    const response = await this.request<StockTransactionInfo[]>(
      'get_stock_tx_info',
      {
        product_code: productCode,
        start_date: startDate,
        end_date: endDate,
      }
    );
    return response.data || [];
  }

  /**
   * Get stock transaction detail information
   * @param productCode - Product code
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   */
  async getStockTxDetailInfo(
    productCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<StockTransactionDetailInfo[]> {
    const response = await this.request<StockTransactionDetailInfo[]>(
      'get_stock_tx_detail_info',
      {
        product_code: productCode,
        start_date: startDate,
        end_date: endDate,
      }
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
   * Get etc information
   */
  async getEtcInfo(): Promise<EtcInfo> {
    const response = await this.request<EtcInfo>('get_etc_info');
    return response.data || {};
  }
}

/**
 * Create a new ONEWMS client instance
 */
export function createOnewmsClient(config?: OnewmsConfig): OnewmsClient {
  return new OnewmsClient(config);
}
