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
 * 운영 재현(2026-06-10 2차): 배포 후에도 "비고(선택)" 이 메모로 저장되는 사례 재보고.
 *   재현 테스트 결과 zero-width space 등 보이지 않는 문자가 섞이면 화면상 동일해
 *   보여도 정규식을 통과함을 확인. 보강:
 *   ① 보이지 않는 문자(ZWSP/ZWNJ/ZWJ/BOM/word joiner/soft hyphen) 제거 후 검사
 *   ② 앞뒤 장식 문자(※ * - · 등) 및 "입력/기재 (하세요)" 류 안내 접미 허용
 *   ③ placeholder 의심 문자열이 필터를 통과하면 codepoint 진단 로그 출력
 *
 * "비고/메모/remark/memo (+ 선택/선택사항/optional)" 만으로 구성된 문자열은
 * 전부 빈 값 처리. 실제 메모는 placeholder 단어만으로 구성되지 않으므로
 * 오탐 위험 낮음.
 */
export const PLACEHOLDER_MEMO_PATTERN =
  /^[\s※*#\-·•_=+~]*(비고|메모|remarks?|memo)[\s]*[(（［\[]?[\s]*(선택(\s*사항)?|optional)?[\s]*[)）］\]]?[\s]*((을|를)?[\s]*(입력|기재|작성)[\s]*(하세요|해[\s]*주세요)?)?[\s.:：!]*$/i;

/** zero-width space/ZWNJ/ZWJ, word joiner, BOM, soft hyphen, mongolian vowel separator */
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF\u00AD\u180E]/g;

/** placeholder 메모는 빈 문자열로, 그 외에는 trim 된 원본 반환 */
export function sanitizeMemo(memo: string | null | undefined): string {
  const raw = String(memo ?? "").replace(INVISIBLE_CHARS, "").trim();
  if (PLACEHOLDER_MEMO_PATTERN.test(raw)) return "";

  // 진단(2026-06-10): placeholder 의심 단어가 포함됐는데 필터를 통과한 경우
  // 정확한 문자 구성을 로그로 남김 (재발 시 Vercel 로그에서 원인 즉시 식별)
  if (raw && /(비고|메모|remark)/i.test(raw)) {
    const codepoints = [...raw]
      .map((c) => c.codePointAt(0)!.toString(16).padStart(4, "0"))
      .join(" ");
    console.warn(`[MEMO_SUSPECT] 필터 통과한 의심 메모: ${JSON.stringify(raw)} (U+${codepoints})`);
  }

  return raw;
}
