/**
 * GET /api/orders/by-broadcast
 *
 * 방송별 통합 발주서 조회
 * 기획서 v2 (6페이지) — "OO방송 / 스스센터 제품 X개 + 본사 제품 Y개" 형태
 *
 * 같은 broadcastId를 가진 모든 Order를 묶고
 * 그 안의 OrderItem을 productType별 (HEADQUARTERS / CENTER) 로 분류해서 반환.
 *
 * 권한: MASTER (본사 마스터 전용 화면)
 */

import { NextRequest } from "next/server";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { withRole } from "@/lib/api/middleware";

export const GET = withRole(["MASTER"], async (req: NextRequest, _user) => {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from"); // YYYY-MM-DD
    const toStr = searchParams.get("to");
    const status = searchParams.get("status"); // optional 발주 상태 필터

    // 기본 기간: 최근 30일
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const from = fromStr ? new Date(fromStr) : defaultFrom;
    const to = toStr ? new Date(toStr) : now;
    // 'to'는 그 날의 끝까지 포함
    to.setHours(23, 59, 59, 999);

    // 같은 방송에 묶인 발주만 (broadcastId 있는 것만)
    const orders = await prisma.order.findMany({
      where: {
        broadcastId: { not: null },
        createdAt: { gte: from, lte: to },
        ...(status ? { status: status as any } : {}),
      },
      include: {
        items: true,
        broadcast: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            sellerId: true,
            seller: { select: { id: true, name: true, username: true } },
          },
        },
        seller: { select: { id: true, name: true, username: true } },
        processingCenter: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // broadcastId 기준 그룹핑
    type Grouped = {
      broadcastId: string;
      broadcastTitle: string;
      broadcastScheduledAt: Date | null;
      sellerName: string;
      hqItemCount: number; // 본사 제품 수량 합계
      centerItemCount: number; // 센터 제품 수량 합계
      hqAmount: number; // 본사 제품 매출
      centerAmount: number; // 센터 제품 매출
      orderCount: number; // 해당 방송에 묶인 발주 수
      orderIds: string[];
      centersInvolved: Array<{ id: string; name: string; code: string }>;
      latestOrderAt: Date;
    };

    const grouped: Record<string, Grouped> = {};

    for (const order of orders) {
      const bid = order.broadcastId!;
      if (!grouped[bid]) {
        grouped[bid] = {
          broadcastId: bid,
          broadcastTitle: order.broadcast?.title || "(제목 없음)",
          broadcastScheduledAt: order.broadcast?.scheduledAt ?? null,
          sellerName: order.broadcast?.seller?.name || order.seller?.name || "—",
          hqItemCount: 0,
          centerItemCount: 0,
          hqAmount: 0,
          centerAmount: 0,
          orderCount: 0,
          orderIds: [],
          centersInvolved: [],
          latestOrderAt: order.createdAt,
        };
      }
      const g = grouped[bid];
      g.orderCount += 1;
      g.orderIds.push(order.id);
      if (order.createdAt > g.latestOrderAt) g.latestOrderAt = order.createdAt;

      // 발주가 가진 센터 정보 (processingCenter)
      if (order.processingCenter) {
        const exists = g.centersInvolved.find(c => c.id === order.processingCenter!.id);
        if (!exists) g.centersInvolved.push(order.processingCenter);
      }

      // OrderItem productType 별 집계
      for (const item of order.items) {
        const qty = item.quantity;
        const amount = item.supplyPrice * qty;
        if (item.productType === "HEADQUARTERS") {
          g.hqItemCount += qty;
          g.hqAmount += amount;
        } else {
          g.centerItemCount += qty;
          g.centerAmount += amount;
        }
      }
    }

    // 정렬: 최근 발주 시각 내림차순
    const result = Object.values(grouped).sort(
      (a, b) => b.latestOrderAt.getTime() - a.latestOrderAt.getTime()
    );

    return ok({
      broadcasts: result,
      count: result.length,
      range: { from, to },
    });
  } catch (err: any) {
    console.error("by-broadcast orders error:", err);
    return errors.internal(err.message);
  }
});
