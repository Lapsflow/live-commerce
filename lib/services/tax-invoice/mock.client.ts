/**
 * Mock Tax Invoice Client
 * console.log + DB 기록
 * TAX_INVOICE_PROVIDER=mock (기본값)
 */

import { prisma } from "@/lib/db/prisma";
import type {
  TaxInvoiceClient,
  TaxInvoiceRequest,
  TaxInvoiceResult,
  TaxInvoiceStatus,
} from "./types";

export class MockTaxInvoiceClient implements TaxInvoiceClient {
  async issue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult> {
    const invoiceNumber = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    console.log("[MOCK_TAX_INVOICE] Issue", {
      orderId: req.orderId,
      orderNo: req.orderNo,
      totalAmount: req.totalAmount,
      invoiceNumber,
    });

    // DB에 발행 기록
    try {
      await prisma.order.update({
        where: { id: req.orderId },
        data: {
          taxInvoiceIssued: true,
          taxInvoiceIssuedAt: new Date(),
          taxInvoiceNumber: invoiceNumber,
        },
      });
    } catch (err) {
      console.error("[MOCK_TAX_INVOICE] DB update failed:", err);
    }

    return { success: true, invoiceNumber };
  }

  async reverseIssue(req: TaxInvoiceRequest): Promise<TaxInvoiceResult> {
    const invoiceNumber = `MOCK-REV-${Date.now()}`;
    console.log("[MOCK_TAX_INVOICE] ReverseIssue", {
      orderId: req.orderId,
      invoiceNumber,
    });
    return { success: true, invoiceNumber };
  }

  async cancel(invoiceNumber: string): Promise<TaxInvoiceResult> {
    console.log("[MOCK_TAX_INVOICE] Cancel", { invoiceNumber });
    return { success: true, invoiceNumber };
  }

  async getStatus(invoiceNumber: string): Promise<TaxInvoiceStatus> {
    console.log("[MOCK_TAX_INVOICE] GetStatus", { invoiceNumber });
    return {
      invoiceNumber,
      status: "MOCK",
      issuedAt: new Date().toISOString(),
    };
  }
}
