/**
 * Barobill Tax Invoice Client (Backup)
 * TAX_INVOICE_PROVIDER=barobill
 *
 * 필요 환경변수:
 *   BAROBILL_CERT_KEY      (바로빌 인증키)
 *   BAROBILL_CORP_NUM      (사업자등록번호)
 *   BAROBILL_ID            (바로빌 아이디)
 *   BAROBILL_IS_TEST       (true=테스트, false=운영)
 *
 * API: SOAP/REST 기반 (바로빌 API 문서 참조)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/db/prisma";
import type {
  TaxInvoiceClient,
  TaxInvoiceRequest,
  TaxInvoiceResult,
  TaxInvoiceStatus,
} from "./types";

const BAROBILL_API_URL = {
  test: "https://testws.barobill.co.kr",
  prod: "https://ws.barobill.co.kr",
};

export class BarobillTaxInvoiceClient implements TaxInvoiceClient {
  private certKey: string;
  private corpNum: string;
  private barobillId: string;
  private baseUrl: string;

  constructor() {
    this.certKey = process.env.BAROBILL_CERT_KEY || "";
    this.corpNum = process.env.BAROBILL_CORP_NUM || "";
    this.barobillId = process.env.BAROBILL_ID || "";
    const isTest = process.env.BAROBILL_IS_TEST === "true";
    this.baseUrl = isTest ? BAROBILL_API_URL.test : BAROBILL_API_URL.prod;

    if (!this.certKey || !this.corpNum) {
      console.warn("[BAROBILL] Credentials not configured");
    }
  }

  async issue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/TI/TaxInvoice.asmx/RegistAndIssueTaxInvoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: this.buildFormData(req),
        }
      );

      const text = await response.text();
      const invoiceNumber = this.parseInvoiceNumber(text);

      if (invoiceNumber) {
        await prisma.order.update({
          where: { id: req.orderId },
          data: {
            taxInvoiceIssued: true,
            taxInvoiceIssuedAt: new Date(),
            taxInvoiceNumber: invoiceNumber,
          },
        });
        return { success: true, invoiceNumber };
      }

      return { success: false, error: "발행 실패 - 응답 파싱 실패" };
    } catch (err: any) {
      console.error("[BAROBILL] Issue failed:", err);
      return { success: false, error: err.message || "발행 실패" };
    }
  }

  async reverseIssue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult> {
    console.warn("[BAROBILL] ReverseIssue not yet implemented");
    return { success: false, error: "바로빌 역발행 미구현" };
  }

  async cancel(invoiceNumber: string): Promise<TaxInvoiceResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/TI/TaxInvoice.asmx/ProcTaxInvoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            CERTKEY: this.certKey,
            CorpNum: this.corpNum,
            ID: this.barobillId,
            MgtKey: invoiceNumber,
            ProcType: "CANCEL",
          }).toString(),
        }
      );

      const text = await response.text();
      const success = text.includes("1") || text.includes("성공");
      return { success, invoiceNumber, error: success ? undefined : text };
    } catch (err: any) {
      console.error("[BAROBILL] Cancel failed:", err);
      return { success: false, error: err.message || "취소 실패" };
    }
  }

  async getStatus(invoiceNumber: string): Promise<TaxInvoiceStatus> {
    console.warn("[BAROBILL] GetStatus returning default");
    return { invoiceNumber, status: "ISSUED" };
  }

  private buildFormData(req: TaxInvoiceRequest): string {
    return new URLSearchParams({
      CERTKEY: this.certKey,
      CorpNum: this.corpNum,
      ID: this.barobillId,
      InvoicerCorpNum: req.supplier.corpNum,
      InvoicerCorpName: req.supplier.corpName,
      InvoicerCEOName: req.supplier.ceoName,
      InvoiceeCorpNum: req.buyer.corpNum,
      InvoiceeCorpName: req.buyer.corpName,
      InvoiceeCEOName: req.buyer.ceoName,
      SupplyAmt: String(req.supplyAmount),
      TaxAmt: String(req.taxAmount),
      TotalAmt: String(req.totalAmount),
      PurposeType: "02", // 영수
    }).toString();
  }

  private parseInvoiceNumber(xml: string): string | null {
    const match = xml.match(/<string[^>]*>([^<]+)<\/string>/);
    return match?.[1] || null;
  }
}
