// app/api/broadcasts/[id]/stats/route.ts
// LIVE-03: 방송 통계 — 매칭된 발주서 기반 판매 데이터
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errors.unauthorized();

    const { id } = await params;

    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true } },
        orders: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, barcode: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!broadcast) {
      return errors.notFound("방송을 찾을 수 없습니다");
    }

    // 매칭된 발주서 기반 통계 산출
    const orders = broadcast.orders;
    const allItems = orders.flatMap((o) => o.items);

    // 상품별 집계
    const productMap = new Map<
      string,
      { name: string; barcode: string; quantity: number; totalSupply: number }
    >();
    for (const item of allItems) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.totalSupply += item.totalSupply;
      } else {
        productMap.set(item.productId, {
          name: item.product?.name || item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          totalSupply: item.totalSupply,
        });
      }
    }

    const topProducts = Array.from(productMap.entries())
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const stats = {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      totalQuantity: allItems.reduce((sum, i) => sum + i.quantity, 0),
      totalSupply: allItems.reduce((sum, i) => sum + i.totalSupply, 0),
      totalMargin: orders.reduce((sum, o) => sum + o.totalMargin, 0),
      topProducts,
      recentOrders: orders.slice(0, 5).map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        totalAmount: o.totalAmount,
        status: o.status,
        matchType: o.matchType,
        createdAt: o.createdAt,
      })),
    };

    return ok(stats);
  } catch (error) {
    console.error("Failed to fetch broadcast stats:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch broadcast stats";
    return errors.internal(message);
  }
}
