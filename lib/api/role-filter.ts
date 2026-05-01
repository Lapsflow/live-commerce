import { Session } from "next-auth";

/**
 * 역할에 따라 조회 가능한 데이터를 필터링
 *
 * - 셀러: 본인 데이터만
 * - 관리자(SUB_MASTER): 소속 센터 데이터
 * - 마스터: 전체 데이터
 */
export function getRoleBasedFilter(
  session: Session | null,
  model: "order" | "broadcast" | "sale"
): any {
  if (!session?.user) {
    throw new Error("인증되지 않은 사용자");
  }

  const { user } = session;

  if (!user.role) {
    throw new Error("권한 정보가 없습니다. 다시 로그인해주세요.");
  }

  // 마스터: 전체 조회
  if (user.role === "MASTER") {
    return {};
  }

  // 관리자: 소속 센터 데이터만
  if (user.role === "SUB_MASTER") {
    const centerId = (user as any).centerId;
    if (centerId) {
      return {
        OR: [
          { seller: { centerId } },
          { sellerId: (user as any).id },
        ],
      };
    }
    return {};
  }

  // 셀러: 본인 데이터만
  if (user.role === "SELLER") {
    return { sellerId: user.id };
  }

  throw new Error("알 수 없는 역할");
}
