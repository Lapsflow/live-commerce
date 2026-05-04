import { Session } from "next-auth";
import { prisma } from "@/lib/db/prisma";

/**
 * 역할 기반 필터 결과
 *
 * - where: Prisma where 조건 (aggregate, groupBy, findMany 용)
 * - sellerIds: raw SQL용 셀러 ID 배열 (null = 필터 없음/전체)
 */
export interface RoleFilterResult {
  where: Record<string, any>;
  sellerIds: string[] | null;
}

/**
 * 역할에 따라 조회 가능한 데이터를 필터링
 *
 * - 마스터: 전체 데이터
 * - 관리자(SUB_MASTER): 본인 센터에 방송 신청한 셀러들의 데이터
 * - 셀러: 본인 데이터만
 */
export async function getRoleBasedFilter(
  session: Session | null,
  model: "order" | "broadcast" | "sale"
): Promise<RoleFilterResult> {
  if (!session?.user) {
    throw new Error("인증되지 않은 사용자");
  }

  const { user } = session;

  if (!user.role) {
    throw new Error("권한 정보가 없습니다. 다시 로그인해주세요.");
  }

  // 마스터: 전체 조회
  if (user.role === "MASTER") {
    return { where: {}, sellerIds: null };
  }

  // 관리자(SUB_MASTER): 본인 센터에 방송 신청한 셀러들의 데이터
  if (user.role === "SUB_MASTER") {
    const centerId = (user as any).centerId;
    if (!centerId) {
      return { where: {}, sellerIds: null };
    }

    // broadcast 모델은 centerId 직접 필터
    if (model === "broadcast") {
      return { where: { centerId }, sellerIds: null };
    }

    // sale/order 모델: 본인 센터에 방송 신청한 셀러 ID 추출
    const broadcasts = await prisma.broadcast.findMany({
      where: { centerId },
      select: { sellerId: true },
      distinct: ["sellerId"],
    });
    const sellerIds = [...new Set(broadcasts.map((b) => b.sellerId))];

    return {
      where: { sellerId: { in: sellerIds } },
      sellerIds,
    };
  }

  // 셀러: 본인 데이터만
  if (user.role === "SELLER") {
    const sellerId = (user as any).userId || user.id;
    return {
      where: { sellerId },
      sellerIds: [sellerId],
    };
  }

  throw new Error("알 수 없는 역할");
}
