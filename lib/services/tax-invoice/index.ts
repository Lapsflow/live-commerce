/**
 * Tax Invoice Service
 * 환경변수 기반 클라이언트 자동 선택
 *
 * TAX_INVOICE_PROVIDER=popbill  → PopbillTaxInvoiceClient (기본)
 * TAX_INVOICE_PROVIDER=barobill → BarobillTaxInvoiceClient (백업)
 * TAX_INVOICE_PROVIDER=mock     → MockTaxInvoiceClient
 */

import type { TaxInvoiceClient, TaxInvoiceRequest, TaxInvoiceResult, TaxInvoiceStatus } from "./types";
import { MockTaxInvoiceClient } from "./mock.client";

let _client: TaxInvoiceClient | undefined;

function getClient(): TaxInvoiceClient {
  if (_client) return _client;

  const provider = process.env.TAX_INVOICE_PROVIDER || "mock";

  if (provider === "popbill") {
    // Dynamic path to prevent bundler from tracing uninstalled SDK
    const modPath = `./${provider}.client`;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modPath);
    _client = new mod.PopbillTaxInvoiceClient();
    console.log("[TaxInvoice] Using PopBill provider");
  } else if (provider === "barobill") {
    const modPath = `./${provider}.client`;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modPath);
    _client = new mod.BarobillTaxInvoiceClient();
    console.log("[TaxInvoice] Using Barobill provider (backup)");
  } else {
    _client = new MockTaxInvoiceClient();
    console.log("[TaxInvoice] Using Mock provider");
  }

  return _client!;
}

/** 세금계산서 발행 */
export async function issueTaxInvoice(
  req: TaxInvoiceRequest
): Promise<TaxInvoiceResult> {
  try {
    return await getClient().issue(req);
  } catch (err: any) {
    console.error("[TaxInvoice] Issue error:", err);
    return { success: false, error: err.message };
  }
}

/** 세금계산서 역발행 */
export async function reverseIssueTaxInvoice(
  req: TaxInvoiceRequest
): Promise<TaxInvoiceResult> {
  try {
    return await getClient().reverseIssue(req);
  } catch (err: any) {
    console.error("[TaxInvoice] ReverseIssue error:", err);
    return { success: false, error: err.message };
  }
}

/** 세금계산서 취소 */
export async function cancelTaxInvoice(
  invoiceNumber: string
): Promise<TaxInvoiceResult> {
  try {
    return await getClient().cancel(invoiceNumber);
  } catch (err: any) {
    console.error("[TaxInvoice] Cancel error:", err);
    return { success: false, error: err.message };
  }
}

/** 세금계산서 상태 조회 */
export async function getTaxInvoiceStatus(
  invoiceNumber: string
): Promise<TaxInvoiceStatus> {
  try {
    return await getClient().getStatus(invoiceNumber);
  } catch (err: any) {
    console.error("[TaxInvoice] Status error:", err);
    return { invoiceNumber, status: "FAILED" };
  }
}

// Re-export types
export type { TaxInvoiceRequest, TaxInvoiceResult, TaxInvoiceStatus, TaxInvoiceClient };
