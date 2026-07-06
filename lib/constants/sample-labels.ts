/**
 * 샘플 상태 라벨 매핑
 *
 * DB enum: CONTINUOUS / SOLD_OUT (+ UNTIL_SOLD deprecated)
 * UI 라벨: 진행중 / 품절
 *
 * 한국무진 확정 (2026-07-03):
 *  - 샘플 등록은 한국무진(마스터)이 직접
 *  - 상태는 "진행중 / 품절" 2단계
 *  - 방송 신청은 자유, 승인 단계에서 마스터가 샘플 상태 보고 거름
 *
 * UNTIL_SOLD 는 20260703090000 마이그레이션으로 CONTINUOUS 이관 완료.
 * 잔존/롤백 데이터 방어를 위해 매핑만 유지.
 */

export const SAMPLE_STATUS_LABELS: Record<string, string> = {
  CONTINUOUS: "진행중",
  SOLD_OUT: "품절",
  UNTIL_SOLD: "진행중", // deprecated — 방어용
};

export const SAMPLE_STATUS_COLORS: Record<string, string> = {
  CONTINUOUS: "bg-green-100 text-green-700",
  SOLD_OUT: "bg-red-100 text-red-700",
  UNTIL_SOLD: "bg-green-100 text-green-700", // deprecated — 방어용
};

/** 품절 판정: 명시적 품절 상태이거나, (구)소진후종료 상품의 재고 소진 */
export function isSampleSoldOut(
  sampleStatus: string | null | undefined,
  totalStock: number | null | undefined
): boolean {
  if (sampleStatus === "SOLD_OUT") return true;
  if (sampleStatus === "UNTIL_SOLD" && (totalStock ?? 0) <= 0) return true;
  return false;
}
