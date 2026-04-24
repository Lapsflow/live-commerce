import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/users/:id/stats
 * 사용자 통계 (방송 수, 매출, 발주, 관리 셀러 등)
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest) => {
    const segments = req.nextUrl.pathname.split("/");
    const statsIdx = segments.indexOf("stats");
    const userId = segments[statsIdx - 1];

    if (!userId) {
      return errors.badRequest("User ID가 필요합니다");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        centerId: true,
        center: { select: { name: true, code: true } },
        admin: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return errors.notFound("user");
    }

    // Parallel queries for stats
    const [broadcastCount, salesAgg, orderCount, sellerCount] =
      await Promise.all([
        prisma.broadcast.count({
          where: { sellerId: userId },
        }),
        prisma.sale.aggregate({
          where: { sellerId: userId },
          _sum: { totalPrice: true },
          _count: true,
        }),
        prisma.order.count({
          where: { sellerId: userId },
        }),
        // Managed sellers (only meaningful for ADMIN role)
        user.role === "ADMIN"
          ? prisma.user.count({ where: { adminId: userId } })
          : Promise.resolve(0),
      ]);

    // Recent broadcasts (last 10)
    const recentBroadcasts = await prisma.broadcast.findMany({
      where: { sellerId: userId },
      orderBy: { scheduledAt: "desc" },
      take: 10,
      select: {
        id: true,
        code: true,
        platform: true,
        status: true,
        scheduledAt: true,
        startedAt: true,
        endedAt: true,
      },
    });

    // Recent orders (last 10)
    const recentOrders = await prisma.order.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNo: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    // Recent sales (last 10)
    const recentSales = await prisma.sale.findMany({
      where: { sellerId: userId },
      orderBy: { saleDate: "desc" },
      take: 10,
      select: {
        id: true,
        saleNo: true,
        quantity: true,
        totalPrice: true,
        saleDate: true,
        product: { select: { name: true } },
      },
    });

    // Managed sellers list (for ADMIN)
    let managedSellers: any[] = [];
    if (user.role === "ADMIN") {
      managedSellers = await prisma.user.findMany({
        where: { adminId: userId },
        select: {
          id: true,
          name: true,
          phone: true,
          channels: true,
          createdAt: true,
          _count: { select: { broadcasts: true, sales: true, orders: true } },
        },
        orderBy: { name: "asc" },
      });
    }

    return ok({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        centerName: user.center?.name ?? null,
        centerCode: user.center?.code ?? null,
        adminName: user.admin?.name ?? null,
      },
      stats: {
        broadcastCount,
        salesCount: salesAgg._count,
        totalSales: salesAgg._sum.totalPrice ?? 0,
        orderCount,
        sellerCount,
      },
      recentBroadcasts,
      recentOrders,
      recentSales,
      managedSellers,
    });
  }
);
