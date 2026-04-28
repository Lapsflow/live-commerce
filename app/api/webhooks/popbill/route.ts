/**
 * POST /api/webhooks/popbill
 * PopBill 세금계산서 상태 변경 Webhook
 *
 * PopBill에서 세금계산서 상태가 변경되면 이 엔드포인트로 콜백.
 * - 국세청 전송 완료
 * - 발행 취소
 * - 오류 발생
 *
 * 보안: PopBill IP 화이트리스트 + 서명 검증 (운영 시 활성화)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// PopBill 콜백 IP (운영 시 화이트리스트 검증)
const POPBILL_IPS = [
  "211.233.52.0/24", // PopBill Production
];

interface PopbillWebhookBody {
  // 세금계산서 관련
  ntsconfirmNum?: string; // 국세청 승인번호
  invoicerCorpNum?: string; // 공급자 사업자번호
  invoiceeCorpNum?: string; // 공급받는자 사업자번호
  stateCode?: number; // 상태코드
  stateDT?: string; // 상태 변경 일시
  // 메시지
  itemKey?: string; // 팝빌 문서번호
  mgtKey?: string; // 관리번호
}

export async function POST(req: NextRequest) {
  try {
    const body: PopbillWebhookBody = await req.json();

    console.log("[PopBill Webhook] Received:", JSON.stringify(body));

    const { ntsconfirmNum, stateCode, stateDT } = body;

    if (!ntsconfirmNum) {
      console.warn("[PopBill Webhook] Missing ntsconfirmNum");
      return NextResponse.json({ result: "OK" }); // ACK anyway
    }

    // 세금계산서 번호로 Order 찾기
    const order = await prisma.order.findFirst({
      where: { taxInvoiceNumber: ntsconfirmNum },
    });

    if (!order) {
      console.warn(`[PopBill Webhook] No order for invoice ${ntsconfirmNum}`);
      return NextResponse.json({ result: "OK" });
    }

    // 상태 업데이트
    // PopBill stateCode: 3=발행완료, 4=전송완료, 5=국세청접수, 6=취소
    const isCompleted = stateCode && stateCode >= 4;
    const isCanceled = stateCode === 6;

    if (isCanceled) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          taxInvoiceIssued: false,
          taxInvoiceNumber: null,
        },
      });
      console.log(`[PopBill Webhook] Invoice ${ntsconfirmNum} cancelled for order ${order.orderNo}`);
    } else if (isCompleted) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          taxInvoiceIssued: true,
          taxInvoiceIssuedAt: stateDT ? new Date(stateDT) : new Date(),
        },
      });
      console.log(`[PopBill Webhook] Invoice ${ntsconfirmNum} confirmed for order ${order.orderNo}`);
    }

    // PopBill expects "OK" response
    return NextResponse.json({ result: "OK" });
  } catch (err) {
    console.error("[PopBill Webhook] Error:", err);
    // Still return OK to prevent PopBill from retrying
    return NextResponse.json({ result: "OK" });
  }
}
