import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/proposals/cart
 *
 * 샘플 장바구니 조회
 * 현재 로그인한 사용자의 장바구니 아이템 목록을 반환
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    const cartItems = await prisma.proposalCart.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            barcode: true,
            sellPrice: true,
            supplyPrice: true,
            totalStock: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalItems = cartItems.length;
    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.samplePrice * item.quantity,
      0
    );

    return ok({
      items: cartItems,
      summary: {
        totalItems,
        totalQuantity,
        totalAmount,
      },
    });
  } catch (error) {
    console.error("[ProposalCart] Failed to fetch cart:", error);
    const message = error instanceof Error ? error.message : "장바구니 조회 실패";
    return errors.internal(message);
  }
}

/**
 * POST /api/proposals/cart
 *
 * 샘플 장바구니에 상품 추가
 * Request Body: { productId, quantity?, samplePrice? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    const body = await req.json();
    const { productId, quantity = 1, samplePrice = 0 } = body;

    if (!productId) {
      return errors.badRequest("productId가 필요합니다");
    }

    if (quantity < 1) {
      return errors.badRequest("수량은 1개 이상이어야 합니다");
    }

    // 상품 존재 여부 확인
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return errors.notFound("상품을 찾을 수 없습니다");
    }

    // 장바구니에 이미 있으면 수량 업데이트, 없으면 추가
    const cartItem = await prisma.proposalCart.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
      create: {
        userId: session.user.id,
        productId,
        quantity,
        samplePrice,
      },
      update: {
        quantity: {
          increment: quantity,
        },
        samplePrice, // 최신 가격으로 업데이트
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            barcode: true,
            sellPrice: true,
            supplyPrice: true,
          },
        },
      },
    });

    return ok(cartItem);
  } catch (error) {
    console.error("[ProposalCart] Failed to add to cart:", error);
    const message = error instanceof Error ? error.message : "장바구니 추가 실패";
    return errors.internal(message);
  }
}

/**
 * DELETE /api/proposals/cart?productId={productId}
 *
 * 샘플 장바구니에서 상품 제거
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return errors.badRequest("productId가 필요합니다");
    }

    // 해당 아이템 존재 여부 확인
    const existing = await prisma.proposalCart.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    if (!existing) {
      return errors.notFound("장바구니에 해당 상품이 없습니다");
    }

    // 삭제
    await prisma.proposalCart.delete({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });

    return ok({ message: "장바구니에서 제거되었습니다" });
  } catch (error) {
    console.error("[ProposalCart] Failed to remove from cart:", error);
    const message = error instanceof Error ? error.message : "장바구니 제거 실패";
    return errors.internal(message);
  }
}
