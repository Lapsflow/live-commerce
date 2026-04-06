import { Session } from "next-auth";

/**
 * 역할에 따라 조회 가능한 데이터를 필터링
 *
 * Apps Script 로직:
 * - 셀러: 본인 데이터만
 * - 관리자: 소속 셀러 데이터만
 * - 마스터/부마스터: 전체 데이터
 */
export function getRoleBasedFilter(
  session: Session | null,
  model: "order" | "broadcast" | "sale"
): any {
  if (!session?.user) {
    throw new Error("인증되지 않은 사용자");
  }

  const { user } = session;

  // 마스터, 부마스터: 전체 조회
  if (user.role === "MASTER" || user.role === "SUB_MASTER") {
    return {};
  }

  // 셀러: 본인 데이터만
  if (user.role === "SELLER") {
    return { sellerId: user.id };
  }

  // 관리자: 소속 셀러 데이터
  if (user.role === "ADMIN") {
    return {
      OR: [
        { sellerId: user.id }, // 본인 데이터
        { seller: { adminId: user.id } }, // 소속 셀러 데이터
      ],
    };
  }

  throw new Error("알 수 없는 역할");
}
