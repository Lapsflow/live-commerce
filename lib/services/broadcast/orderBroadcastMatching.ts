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
 * 발주서 생성 시 같은 셀러의 방송을 자동 매칭
 * B-8: 24h window — LIVE 또는 최근 24시간 내 종료된 방송도 매칭 대상
 *
 * 규칙 (우선순위):
 * 1. 현재 LIVE 방송 → 즉시 매칭
 * 2. 같은 날짜 SCHEDULED 방송 → 가장 가까운 시간대 선택
 * 3. 최근 24h 내 ENDED 방송 → 가장 최근 종료 방송 선택
 * 4. 위 모두 없음 → 보류 (수동 매칭 필요)
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

  // B-8: 24h window 계산
  const now = orderDate.getTime();
  const window24h = new Date(now - 24 * 60 * 60 * 1000);
  const dayStart = new Date(orderDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(orderDate);
  dayEnd.setHours(23, 59, 59, 999);

  // 1단계: 현재 LIVE 방송 조회
  const liveBroadcast = await prisma.broadcast.findFirst({
    where: {
      sellerId,
      status: "LIVE",
    },
    select: { id: true, code: true, centerId: true, scheduledAt: true },
    orderBy: { startedAt: "desc" },
  });

  if (liveBroadcast) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        broadcastId: liveBroadcast.id,
        matchType: "AUTO",
        processingCenterId: liveBroadcast.centerId || undefined,
      },
    });
    return {
      matched: true,
      broadcastId: liveBroadcast.id,
      matchType: "AUTO",
      reason: `LIVE 방송 "${liveBroadcast.code}"에 자동 매칭됨`,
    };
  }

  // 2단계: 같은 날짜 SCHEDULED 방송
  const scheduledBroadcasts = await prisma.broadcast.findMany({
    where: {
      sellerId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: "SCHEDULED",
    },
    orderBy: { scheduledAt: "asc" },
    select: { id: true, code: true, centerId: true, scheduledAt: true },
  });

  if (scheduledBroadcasts.length > 0) {
    let target = scheduledBroadcasts[0];
    if (scheduledBroadcasts.length > 1) {
      let minDiff = Infinity;
      for (const bc of scheduledBroadcasts) {
        const diff = Math.abs(new Date(bc.scheduledAt).getTime() - now);
        if (diff < minDiff) {
          minDiff = diff;
          target = bc;
        }
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        broadcastId: target.id,
        matchType: "AUTO",
        processingCenterId: target.centerId || undefined,
      },
    });
    return {
      matched: true,
      broadcastId: target.id,
      matchType: "AUTO",
      reason:
        scheduledBroadcasts.length === 1
          ? `예정 방송 "${target.code}"에 자동 매칭됨`
          : `${scheduledBroadcasts.length}건 중 가장 가까운 방송 "${target.code}"에 자동 매칭됨`,
    };
  }

  // 3단계: 최근 24h 내 ENDED 방송
  const endedBroadcast = await prisma.broadcast.findFirst({
    where: {
      sellerId,
      status: "ENDED",
      endedAt: { gte: window24h },
    },
    select: { id: true, code: true, centerId: true },
    orderBy: { endedAt: "desc" },
  });

  if (endedBroadcast) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        broadcastId: endedBroadcast.id,
        matchType: "AUTO",
        processingCenterId: endedBroadcast.centerId || undefined,
      },
    });
    return {
      matched: true,
      broadcastId: endedBroadcast.id,
      matchType: "AUTO",
      reason: `최근 종료 방송 "${endedBroadcast.code}"에 자동 매칭됨 (24h window)`,
    };
  }

  return {
    matched: false,
    broadcastId: null,
    matchType: null,
    reason: "매칭 가능한 방송이 없습니다. 수동 매칭이 필요합니다.",
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
