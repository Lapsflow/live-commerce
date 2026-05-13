/**
 * 권한 라벨 매핑
 *
 * DB enum: MASTER / SUB_MASTER / SELLER
 * UI 라벨: 마스터(본사) / 센터관리자 / 셀러
 *
 * 기획서 v2 (2026-05-12) 기준 명명 통일:
 *  - MASTER     → "마스터(본사)"   (= PDF의 본사)
 *  - SUB_MASTER → "센터관리자"     (= PDF의 센터)
 *  - SELLER     → "셀러"
 */

export const ROLE_LABELS: Record<string, string> = {
  MASTER: "마스터(본사)",
  SUB_MASTER: "센터관리자",
  SELLER: "셀러",
};

export const ROLE_COLORS: Record<string, string> = {
  MASTER: "bg-purple-100 text-purple-800",
  SUB_MASTER: "bg-blue-100 text-blue-800",
  SELLER: "bg-green-100 text-green-800",
};
