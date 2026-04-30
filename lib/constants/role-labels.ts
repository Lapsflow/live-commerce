/**
 * 권한 라벨 매핑 (Phase 4 권한 명칭 통합)
 *
 * DB enum: MASTER / SUB_MASTER / ADMIN / SELLER (변경 없음)
 * UI 라벨: 전체관리자 / 관리자 / 관리자 / 셀러
 *
 * SUB_MASTER와 ADMIN은 UI에서 동일한 "관리자"로 표시하되,
 * 코드 내부 권한 분리(role-filter.ts)는 그대로 유지.
 */

export const ROLE_LABELS: Record<string, string> = {
  MASTER: "전체관리자",
  SUB_MASTER: "관리자",
  ADMIN: "관리자",
  SELLER: "셀러",
};

export const ROLE_COLORS: Record<string, string> = {
  MASTER: "bg-purple-100 text-purple-800",
  SUB_MASTER: "bg-blue-100 text-blue-800",
  ADMIN: "bg-blue-100 text-blue-800",
  SELLER: "bg-green-100 text-green-800",
};
