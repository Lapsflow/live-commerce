// lib/services/broadcast/orderBroadcastMatching.ts
// LIVE-03: 발주서→방송 자동 매칭 서비스
import { prisma } from "@/lib/db/prisma";

interface MatchResult {
  matched: boolean;
  broadcastId: string | null;
  matchType: "AUTO" | "MANUAL" | null;
  reason: string;
}

/**
 * 발주서 생성 시 같은 셀러의 같은 날짜 방송을 자동 매칭
 *
 * 규칙:
 * - 같은 날짜 방송 1건 → 자동 매칭
 * - 같은 날짜 방송 여러 건 → 발주 시점과 가장 가까운 방송 선택
 * - 같은 날짜 방송 없음 → 보류 (수동 매칭 필요)
 */
export async function matchOrderToBroadcast(
  orderId: string,
  sellerId: string,
  orderDate: Date
): Promise<MatchResult> {
  // 이미 매칭된 주문은 스킵
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { broadcastId: true },
  });

  if (order?.broadcastId) {
    return {
      matched: true,
      broadcastId: order.broadcastId,
      matchType: "AUTO",
      reason: "이미 매칭됨",
    };
  }

  // 같은 날짜 범위 계산 (한국 시간 기준 00:00~23:59)
  const dayStart = new Date(orderDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(orderDate);
  dayEnd.setHours(23, 59, 59, 999);

  // 같은 셀러 + 같은 날짜 + 유효 상태 방송 조회
  const broadcasts = await prisma.broadcast.findMany({
    where: {
      sellerId,
      scheduledAt: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: { in: ["SCHEDULED", "LIVE", "ENDED"] },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      code: true,
      scheduledAt: true,
    },
  });

  if (broadcasts.length === 0) {
    return {
      matched: false,
      broadcastId: null,
      matchType: null,
      reason: "같은 날짜에 방송이 없습니다. 수동 매칭이 필요합니다.",
    };
  }

  // 1건이면 바로 매칭
  let targetBroadcast = broadcasts[0];

  // 여러 건이면 가장 가까운 시간대 방송 선택
  if (broadcasts.length > 1) {
    const orderTime = orderDate.getTime();
    let minDiff = Infinity;

    for (const bc of broadcasts) {
      const diff = Math.abs(new Date(bc.scheduledAt).getTime() - orderTime);
      if (diff < minDiff) {
        minDiff = diff;
        targetBroadcast = bc;
      }
    }
  }

  // 매칭 적용
  await prisma.order.update({
    where: { id: orderId },
    data: {
      broadcastId: targetBroadcast.id,
      matchType: "AUTO",
    },
  });

  return {
    matched: true,
    broadcastId: targetBroadcast.id,
    matchType: "AUTO",
    reason:
      broadcasts.length === 1
        ? `방송 "${targetBroadcast.code}"에 자동 매칭됨`
        : `${broadcasts.length}건 중 가장 가까운 방송 "${targetBroadcast.code}"에 자동 매칭됨`,
  };
}

/**
 * 수동 매칭: 마스터/센터담당자가 직접 방송을 지정
 */
export async function manualMatchOrderToBroadcast(
  orderId: string,
  broadcastId: string
): Promise<MatchResult> {
  const [order, broadcast] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true },
    }),
    prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { id: true, code: true, sellerId: true },
    }),
  ]);

  if (!order) {
    return { matched: false, broadcastId: null, matchType: null, reason: "주문을 찾을 수 없습니다." };
  }

  if (!broadcast) {
    return { matched: false, broadcastId: null, matchType: null, reason: "방송을 찾을 수 없습니다." };
  }

  // 셀러 일치 검증
  if (order.sellerId !== broadcast.sellerId) {
    return {
      matched: false,
      broadcastId: null,
      matchType: null,
      reason: "발주서 셀러와 방송 셀러가 일치하지 않습니다.",
    };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      broadcastId,
      matchType: "MANUAL",
    },
  });

  return {
    matched: true,
    broadcastId,
    matchType: "MANUAL",
    reason: `방송 "${broadcast.code}"에 수동 매칭됨`,
  };
}

/**
 * 매칭 해제
 */
export async function unmatchOrderFromBroadcast(orderId: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      broadcastId: null,
      matchType: null,
    },
  });
}
