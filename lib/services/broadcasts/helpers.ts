import { prisma } from "@/lib/db/prisma";

/**
 * B-5: Active broadcast helpers
 * 방송 기반 센터 접근 제어를 위한 헬퍼 함수들
 */

/**
 * 셀러의 현재 LIVE 방송 조회
 */
export async function getActiveBroadcastForSeller(sellerId: string) {
  return prisma.broadcast.findFirst({
    where: {
      sellerId,
      status: "LIVE",
    },
    include: {
      center: { select: { id: true, code: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * 셀러의 현재 LIVE 방송의 centerId 반환
 * null이면 활성 방송 없음
 */
export async function getActiveCenterIdForSeller(sellerId: string): Promise<string | null> {
  const broadcast = await prisma.broadcast.findFirst({
    where: {
      sellerId,
      status: "LIVE",
    },
    select: { centerId: true },
    orderBy: { startedAt: "desc" },
  });
  return broadcast?.centerId || null;
}

/**
 * 셀러의 최근 종료된 방송들의 centerId 목록 (24h window)
 * 주문 매칭 풀에 사용
 */
export async function getRecentlyEndedCenterIdsForSeller(
  sellerId: string,
  hours: number = 24
): Promise<string[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const broadcasts = await prisma.broadcast.findMany({
    where: {
      sellerId,
      status: "ENDED",
      endedAt: { gte: cutoff },
      centerId: { not: null },
    },
    select: { centerId: true },
    distinct: ["centerId"],
  });

  return broadcasts.map((b) => b.centerId!).filter(Boolean);
}

/**
 * 셀러가 접근 가능한 센터 ID 목록 (LIVE + 최근 24h 종료)
 * 바코드 스캔, 주문 매칭에 사용
 */
export async function getAccessibleCenterIdsForSeller(
  sellerId: string,
  hours: number = 24
): Promise<string[]> {
  const [activeCenterId, recentCenterIds] = await Promise.all([
    getActiveCenterIdForSeller(sellerId),
    getRecentlyEndedCenterIdsForSeller(sellerId, hours),
  ]);

  const centerIds = new Set<string>();
  if (activeCenterId) centerIds.add(activeCenterId);
  recentCenterIds.forEach((id) => centerIds.add(id));

  return Array.from(centerIds);
}
