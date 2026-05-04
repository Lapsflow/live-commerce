/**
 * POST /api/proposals/payment/virtual-account
 * 샘플 결제용 가상계좌 발급 (Toss Payments 패턴 재사용)
 *
 * Body: { proposalIds: string[], totalAmount: number }
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";

const TOSS_API_URL = "https://api.tosspayments.com/v1/virtual-accounts";
const VALID_HOURS = 24; // 샘플은 24시간 유효

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    const userRole = (session.user as any)?.role;
    if (!userRole || !["MASTER", "SUB_MASTER"].includes(userRole)) {
      return errors.forbidden("접근 권한이 없습니다");
    }

    const body = await req.json();
    const { proposalIds, totalAmount } = body;

    if (!proposalIds?.length || !totalAmount) {
      return errors.badRequest("proposalIds와 totalAmount가 필요합니다");
    }

    // 해당 proposals가 사용자 것인지 확인
    const proposals = await prisma.proposal.findMany({
      where: {
        id: { in: proposalIds },
        submittedBy: session.user.id,
      },
    });

    if (proposals.length !== proposalIds.length) {
      return errors.badRequest("일부 샘플 요청을 찾을 수 없습니다");
    }

    const tossSecretKey = process.env.TOSS_SECRET_KEY;

    // Toss 키 없으면 Mock 가상계좌
    if (!tossSecretKey) {
      const mockAccount = {
        accountNumber: `9999-${Date.now().toString().slice(-8)}`,
        bank: "KB국민은행",
        bankCode: "004",
        amount: totalAmount,
        expiryAt: new Date(
          Date.now() + VALID_HOURS * 60 * 60 * 1000
        ).toISOString(),
        validHours: VALID_HOURS,
        isMock: true,
      };

      console.log(
        "[Sample Virtual Account] MOCK:",
        JSON.stringify(mockAccount)
      );

      return ok(mockAccount);
    }

    // Toss Payments API 호출
    const authHeader = `Basic ${Buffer.from(`${tossSecretKey}:`).toString("base64")}`;

    const response = await fetch(TOSS_API_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: totalAmount,
        orderId: `sample_${session.user.id}_${Date.now()}`,
        orderName: `샘플 결제 (${proposals.length}건)`,
        customerName:
          (session.user as any).name || session.user.email || "고객",
        validHours: VALID_HOURS,
        bank: "KB",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("[Sample Virtual Account] Toss API error:", errorData);
      const errorMessage = errorData?.message || "가상계좌 발급에 실패했습니다";

      // 요청자에게 실패 알림
      const requester = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, phone: true, email: true },
      });
      if (requester?.phone) {
        sendNotification({
          type: "ORDER_VA_FAILED",
          recipient: {
            name: requester.name,
            phone: requester.phone,
            email: requester.email || undefined,
          },
          variables: {
            orderCode: `샘플 ${proposals.length}건`,
            errorMessage,
          },
        }).catch((err) => console.error("[SAMPLE_VA_FAIL_NOTIF]", err));
      }

      // 관리자 알림
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["MASTER", "SUB_MASTER"] }, isActive: true },
          select: { name: true, phone: true, email: true },
        });
        for (const admin of admins) {
          if (admin.phone) {
            sendNotification({
              type: "ORDER_VA_FAILED",
              recipient: { name: admin.name, phone: admin.phone, email: admin.email || undefined },
              variables: { orderCode: `[샘플] ${proposals.length}건`, errorMessage },
            }).catch((err) => console.error("[SAMPLE_VA_FAIL_ADMIN]", err));
          }
        }
      } catch (notifErr) {
        console.error("[SAMPLE_VA_FAIL_ADMIN]", notifErr);
      }

      return errors.internal(errorMessage);
    }

    const tossResponse = await response.json();
    const expiryAt = new Date(
      Date.now() + VALID_HOURS * 60 * 60 * 1000
    ).toISOString();

    return ok({
      accountNumber: tossResponse.accountNumber,
      bank: tossResponse.bank,
      bankCode: tossResponse.bankCode,
      amount: totalAmount,
      expiryAt,
      validHours: VALID_HOURS,
      isMock: false,
    });
  } catch (error) {
    console.error("[Sample Virtual Account] Error:", error);
    const message =
      error instanceof Error ? error.message : "가상계좌 발급 중 오류";

    // 관리자 알림 (네트워크 장애 수준)
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["MASTER", "SUB_MASTER"] }, isActive: true },
        select: { name: true, phone: true, email: true },
      });
      for (const admin of admins) {
        if (admin.phone) {
          sendNotification({
            type: "ORDER_VA_FAILED",
            recipient: { name: admin.name, phone: admin.phone, email: admin.email || undefined },
            variables: { orderCode: "[샘플 가상계좌]", errorMessage: message },
          }).catch(() => {});
        }
      }
    } catch {
      // notification failure shouldn't block error response
    }

    return errors.internal(message);
  }
}
