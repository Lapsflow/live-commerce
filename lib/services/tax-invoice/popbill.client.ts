/**
 * PopBill Tax Invoice Client
 * TAX_INVOICE_PROVIDER=popbill
 *
 * 필요 환경변수:
 *   POPBILL_LINK_ID        (팝빌 링크 아이디)
 *   POPBILL_SECRET_KEY     (팝빌 비밀키)
 *   POPBILL_CORP_NUM       (팝빌 사업자등록번호)
 *   POPBILL_IS_TEST        (true=테스트, false=운영)
 *
 * SDK: npm install popbill
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/db/prisma";
import type {
  TaxInvoiceClient,
  TaxInvoiceRequest,
  TaxInvoiceResult,
  TaxInvoiceStatus,
} from "./types";

export class PopbillTaxInvoiceClient implements TaxInvoiceClient {
  private linkId: string;
  private secretKey: string;
  private corpNum: string;
  private isTest: boolean;

  constructor() {
    this.linkId = process.env.POPBILL_LINK_ID || "";
    this.secretKey = process.env.POPBILL_SECRET_KEY || "";
    this.corpNum = process.env.POPBILL_CORP_NUM || "";
    this.isTest = process.env.POPBILL_IS_TEST === "true";

    if (!this.linkId || !this.secretKey) {
      console.warn("[POPBILL] Credentials not configured");
    }
  }

  async issue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult> {
    try {
      const popbill = await this.getClient();
      const taxInvoice = this.buildTaxInvoice(req);

      const result = await new Promise<any>((resolve, reject) => {
        popbill.registIssue(
          this.corpNum,
          taxInvoice,
          (res: any) => resolve(res),
          (err: any) => reject(err)
        );
      });

      const invoiceNumber = result?.ntsconfirmNum || `PB-${Date.now()}`;

      // DB 업데이트
      await prisma.order.update({
        where: { id: req.orderId },
        data: {
          taxInvoiceIssued: true,
          taxInvoiceIssuedAt: new Date(),
          taxInvoiceNumber: invoiceNumber,
        },
      });

      return { success: true, invoiceNumber };
    } catch (err: any) {
      console.error("[POPBILL] Issue failed:", err);
      return { success: false, error: err.message || "발행 실패" };
    }
  }

  async reverseIssue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult> {
    try {
      const popbill = await this.getClient();
      const taxInvoice = this.buildTaxInvoice(req, true);

      const result = await new Promise<any>((resolve, reject) => {
        popbill.registRequest(
          this.corpNum,
          taxInvoice,
          (res: any) => resolve(res),
          (err: any) => reject(err)
        );
      });

      return { success: true, invoiceNumber: result?.ntsconfirmNum };
    } catch (err: any) {
      console.error("[POPBILL] ReverseIssue failed:", err);
      return { success: false, error: err.message || "역발행 요청 실패" };
    }
  }

  async cancel(invoiceNumber: string): Promise<TaxInvoiceResult> {
    try {
      const popbill = await this.getClient();

      await new Promise<any>((resolve, reject) => {
        popbill.cancelIssue(
          this.corpNum,
          { ntsconfirmNum: invoiceNumber } as any,
          (res: any) => resolve(res),
          (err: any) => reject(err)
        );
      });

      return { success: true, invoiceNumber };
    } catch (err: any) {
      console.error("[POPBILL] Cancel failed:", err);
      return { success: false, error: err.message || "취소 실패" };
    }
  }

  async getStatus(invoiceNumber: string): Promise<TaxInvoiceStatus> {
    try {
      const popbill = await this.getClient();

      const result = await new Promise<any>((resolve, reject) => {
        popbill.getDetailInfo(
          this.corpNum,
          { ntsconfirmNum: invoiceNumber } as any,
          (res: any) => resolve(res),
          (err: any) => reject(err)
        );
      });

      return {
        invoiceNumber,
        status: result?.stateCode === 3 ? "ISSUED" : "FAILED",
        issuedAt: result?.issueDT,
      };
    } catch (err: any) {
      console.error("[POPBILL] GetStatus failed:", err);
      return { invoiceNumber, status: "FAILED" };
    }
  }

  private async getClient(): Promise<any> {
    // Turbopack ignores serverExternalPackages → eval hides from static analysis
    // eslint-disable-next-line no-eval
    const PopbillSDK = eval('require')("popbill");
    PopbillSDK.config({
      LinkID: this.linkId,
      SecretKey: this.secretKey,
      IsTest: this.isTest,
      defaultErrorHandler: (err: any) => {
        console.error("[POPBILL SDK Error]", err);
      },
    });
    return PopbillSDK.TaxinvoiceService;
  }

  private buildTaxInvoice(req: TaxInvoiceRequest, isReverse = false): any {
    return {
      writeDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      chargeDirection: isReverse ? "역발행" : "정발행",
      issueType: isReverse ? "역발행" : "정발행",
      purposeType: "영수",
      supplyCostTotal: String(req.supplyAmount),
      taxTotal: String(req.taxAmount),
      totalAmount: String(req.totalAmount),
      invoicerCorpNum: req.supplier.corpNum,
      invoicerCorpName: req.supplier.corpName,
      invoicerCEOName: req.supplier.ceoName,
      invoicerAddr: req.supplier.addr,
      invoicerBizType: req.supplier.bizType,
      invoicerBizClass: req.supplier.bizClass,
      invoicerEmail: req.supplier.email,
      invoiceeCorpNum: req.buyer.corpNum,
      invoiceeCorpName: req.buyer.corpName,
      invoiceeCEOName: req.buyer.ceoName,
      invoiceeAddr: req.buyer.addr,
      invoiceeBizType: req.buyer.bizType,
      invoiceeBizClass: req.buyer.bizClass,
      invoiceeEmail: req.buyer.email,
    };
  }
}
