/**
 * 메모 placeholder 필터 (공용)
 *
 * 운영 검증(2026-05-26): 엑셀 템플릿의 메모 셀 placeholder "비고 (선택)" 가
 *   그대로 ONEWMS 로 전송되는 버그 발견.
 * 운영 재보고(2026-06-08): Set 완전일치만으로는 공백·전각괄호·"선택사항" 등
 *   변형을 못 잡음. 정규식으로 보강.
 * 2026-06-10: bulk 업로드 파싱 단계에만 필터가 있어, 필터 배포 이전에 업로드되어
 *   DB 에 placeholder 메모가 저장된 발주가 컨펌 → WMS 동기화될 때 여전히
 *   placeholder 가 전송되는 갭 발견. 공용 유틸로 추출하여 업로드 파싱 시점과
 *   ONEWMS 동기화 시점(orderSync) 양쪽에서 필터 적용.
 *
 * "비고/메모/remark/memo (+ 선택/선택사항/optional)" 형태의 placeholder 는
 * 전부 빈 값 처리. 실제 메모는 placeholder 단어만으로 구성되지 않으므로
 * 오탐 위험 낮음.
 */
export const PLACEHOLDER_MEMO_PATTERN =
  /^[\s]*(비고|메모|remarks?|memo)[\s]*[(（［\[]?[\s]*(선택(\s*사항)?|optional)?[\s]*[)）］\]]?[\s]*$/i;

/** placeholder 메모는 빈 문자열로, 그 외에는 trim 된 원본 반환 */
export function sanitizeMemo(memo: string | null | undefined): string {
  const raw = String(memo ?? "").trim();
  return PLACEHOLDER_MEMO_PATTERN.test(raw) ? "" : raw;
}
