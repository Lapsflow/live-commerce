/**
 * Tax Invoice Service Types
 * 세금계산서 발행 공통 인터페이스
 */

// ── Request ──

export interface TaxInvoiceRequest {
  /** 주문 ID */
  orderId: string;
  /** 주문 번호 */
  orderNo: string;
  /** 공급가 합계 */
  supplyAmount: number;
  /** 세액 (공급가의 10%) */
  taxAmount: number;
  /** 합계 금액 */
  totalAmount: number;

  /** 공급자 정보 (본사) */
  supplier: {
    corpNum: string; // 사업자등록번호
    corpName: string;
    ceoName: string;
    addr: string;
    bizType: string; // 업태
    bizClass: string; // 업종
    email?: string;
  };

  /** 공급받는 자 정보 (셀러) */
  buyer: {
    corpNum: string; // 사업자등록번호
    corpName: string;
    ceoName: string;
    addr?: string;
    bizType?: string;
    bizClass?: string;
    email?: string;
  };
}

// ── Result ──

export interface TaxInvoiceResult {
  success: boolean;
  invoiceNumber?: string; // 세금계산서 번호 (국세청 승인번호)
  error?: string;
}

// ── Status ──

export interface TaxInvoiceStatus {
  invoiceNumber: string;
  status: "ISSUED" | "CANCELLED" | "FAILED" | "MOCK";
  issuedAt?: string;
  cancelledAt?: string;
}

// ── Client Interface ──

export interface TaxInvoiceClient {
  /** 세금계산서 발행 */
  issue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult>;
  /** 세금계산서 역발행 (매입자 요청) */
  reverseIssue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult>;
  /** 세금계산서 취소 */
  cancel(invoiceNumber: string): Promise<TaxInvoiceResult>;
  /** 세금계산서 상태 조회 */
  getStatus(invoiceNumber: string): Promise<TaxInvoiceStatus>;
}
