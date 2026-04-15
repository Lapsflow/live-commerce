import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

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
