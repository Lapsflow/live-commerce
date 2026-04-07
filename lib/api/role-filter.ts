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
  console.log("[Role Filter] Received session:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    role: session?.user?.role,
    userId: session?.user?.userId,
  });

  if (!session?.user) {
    console.error("[Role Filter] No session or user");
    throw new Error("인증되지 않은 사용자");
  }

  const { user } = session;

  // 방어 로직: role이 없으면 명확한 에러 메시지
  if (!user.role) {
    console.error("[Role Filter] Missing role in session. User:", user);
    throw new Error("권한 정보가 없습니다. 다시 로그인해주세요.");
  }

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
