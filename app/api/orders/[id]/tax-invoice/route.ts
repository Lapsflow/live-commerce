/**
 * POST /api/orders/:id/tax-invoice — 세금계산서 발행
 * DELETE /api/orders/:id/tax-invoice — 세금계산서 취소
 */

import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { issueTaxInvoice, cancelTaxInvoice } from "@/lib/services/tax-invoice";
import { logAudit } from "@/lib/services/audit";

/** 세금계산서 발행 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
  async (
    req: NextRequest,
    user: AuthUser,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: orderId } = await params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          seller: { select: { name: true, email: true } },
          items: true,
        },
      });

      if (!order) {
        return errors.notFound("order");
      }

      if (order.taxInvoiceIssued) {
        return errors.badRequest(
          `이미 세금계산서가 발���되었습니다 (${order.taxInvoiceNumber})`
        );
      }

      // 공급가 합계 및 세액 계산
      const supplyAmount = order.totalAmount;
      const taxAmount = Math.round(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;

      const result = await issueTaxInvoice({
        orderId: order.id,
        orderNo: order.orderNo,
        supplyAmount,
        taxAmount,
        totalAmount,
        supplier: {
          corpNum: process.env.COMPANY_CORP_NUM || "0000000000",
          corpName: process.env.COMPANY_NAME || "슈퍼무진",
          ceoName: process.env.COMPANY_CEO || "대표자",
          addr: process.env.COMPANY_ADDR || "",
          bizType: process.env.COMPANY_BIZ_TYPE || "도소매",
          bizClass: process.env.COMPANY_BIZ_CLASS || "전자상거래",
          email: process.env.COMPANY_EMAIL,
        },
        buyer: {
          corpNum: "", // 셀러 사업자등록번호 (향후 User 모델에 추가 가능)
          corpName: order.seller.name,
          ceoName: order.seller.name,
          email: order.seller.email || undefined,
        },
      });

      if (!result.success) {
        return errors.internal(result.error || "세금계산��� 발행 실패");
      }

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "CREATE",
        entityType: "TaxInvoice",
        entityId: orderId,
        entityName: order.orderNo,
        after: { invoiceNumber: result.invoiceNumber, totalAmount },
        description: `세금계산서 발행: ${order.orderNo}`,
        request: req,
      });

      return ok({
        message: "세금계산서가 발행되었습니다",
        invoiceNumber: result.invoiceNumber,
      });
    } catch (err: any) {
      console.error("[TAX_INVOICE_ISSUE]", err);
      return errors.internal(err.message);
    }
  }
);

/** 세금계산서 취소 */
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER"],
  async (
    req: NextRequest,
    user: AuthUser,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: orderId } = await params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return errors.notFound("order");
      }

      if (!order.taxInvoiceIssued || !order.taxInvoiceNumber) {
        return errors.badRequest("발행된 세금계산서가 없습니다");
      }

      const result = await cancelTaxInvoice(order.taxInvoiceNumber);

      if (result.success) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            taxInvoiceIssued: false,
            taxInvoiceIssuedAt: null,
            taxInvoiceNumber: null,
          },
        });

        logAudit({
          userId: user.userId,
          userRole: user.role,
          userName: user.name,
          action: "DELETE",
          entityType: "TaxInvoice",
          entityId: orderId,
          before: { taxInvoiceNumber: order.taxInvoiceNumber },
          description: `세금계산서 취소: ${order.taxInvoiceNumber}`,
          request: req,
        });
      }

      return ok({
        message: result.success ? "��금계산서가 취소��었습니다" : "취소 실패",
        success: result.success,
        error: result.error,
      });
    } catch (err: any) {
      console.error("[TAX_INVOICE_CANCEL]", err);
      return errors.internal(err.message);
    }
  }
);
