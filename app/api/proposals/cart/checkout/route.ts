import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/services/notifications";

/**
 * POST /api/proposals/cart/checkout
 *
 * 장바구니 전체 샘플 일괄 주문
 * 장바구니의 모든 아이템을 Proposal로 변환하고 장바구니 비우기
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    // 장바구니 아이템 조회
    const cartItems = await prisma.proposalCart.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        product: true,
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return errors.badRequest("장바구니가 비어있습니다");
    }

    // 동일 상품 5회 제한 체크 (race condition 방지)
    for (const item of cartItems) {
      const pastCount = await prisma.proposal.count({
        where: {
          submittedBy: session.user.id!,
          productName: item.product.name,
        },
      });
      if (pastCount >= 5) {
        return errors.badRequest(
          `"${item.product.name}"은(는) 이미 5회 샘플 요청되었습니다`
        );
      }
    }

    // 센터별 월간 요청 수 제한 (PDF p13: 센터별 요청 수 제한)
    const userCenterId = (session.user as any)?.centerId;
    if (userCenterId) {
      const MONTHLY_CENTER_LIMIT = 50;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // 해당 센터 소속 모든 사용자의 이번 달 요청 수
      const centerMonthlyCount = await prisma.proposal.count({
        where: {
          user: { centerId: userCenterId },
          createdAt: { gte: startOfMonth },
        },
      });

      if (centerMonthlyCount + cartItems.length > MONTHLY_CENTER_LIMIT) {
        return errors.badRequest(
          `센터 월간 샘플 요청 한도(${MONTHLY_CENTER_LIMIT}건)를 초과합니다. 현재 ${centerMonthlyCount}건 사용 중`
        );
      }
    }

    // Transaction으로 일괄 처리
    const result = await prisma.$transaction(async (tx) => {
      // 각 장바구니 아이템을 Proposal로 생성
      const proposals = await Promise.all(
        cartItems.map((item) =>
          tx.proposal.create({
            data: {
              companyName: item.user.name || "샘플 요청",
              contact: item.user.name || "",
              phone: item.user.phone || item.user.email || "",
              productName: item.product.name,
              category: "샘플",
              description: `샘플 요청 - 수량: ${item.quantity}개, 가격: ${item.samplePrice}원`,
              status: "PENDING",
              submittedBy: session.user.id!,
            },
          })
        )
      );

      // 장바구니 비우기
      await tx.proposalCart.deleteMany({
        where: {
          userId: session.user.id,
        },
      });

      return proposals;
    });

    // PROPOSAL-09: 샘플 결제 완료 알림 → 관리자
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["MASTER", "SUB_MASTER"] } },
        select: { name: true, phone: true, email: true },
      });
      const requesterName = cartItems[0]?.user?.name || "알 수 없음";
      for (const admin of admins) {
        if (admin.phone) {
          sendNotification({
            type: "SAMPLE_CHECKOUT",
            recipient: {
              name: admin.name,
              phone: admin.phone,
              email: admin.email || undefined,
            },
            variables: {
              requesterName,
              itemCount: String(result.length),
            },
          }).catch((err) => console.error("[SAMPLE_NOTIFICATION]", err));
        }
      }
    } catch (notifErr) {
      console.error("[SAMPLE_NOTIFICATION]", notifErr);
    }

    return ok({
      message: "샘플 요청이 완료되었습니다",
      proposalCount: result.length,
      proposals: result,
    });
  } catch (error) {
    console.error("[ProposalCart] Failed to checkout:", error);
    const message = error instanceof Error ? error.message : "샘플 주문 실패";
    return errors.internal(message);
  }
}
