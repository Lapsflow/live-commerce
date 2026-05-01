/**
 * 권한 라벨 매핑
 *
 * DB enum: MASTER / SUB_MASTER / SELLER
 * UI 라벨: 전체관리자 / 관리자 / 셀러
 */

export const ROLE_LABELS: Record<string, string> = {
  MASTER: "전체관리자",
  SUB_MASTER: "관리자",
  SELLER: "셀러",
};

export const ROLE_COLORS: Record<string, string> = {
  MASTER: "bg-purple-100 text-purple-800",
  SUB_MASTER: "bg-blue-100 text-blue-800",
  SELLER: "bg-green-100 text-green-800",
};
