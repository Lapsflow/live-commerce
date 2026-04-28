/**
 * PRODUCT-02: 상품 코드 형식 검증
 *
 * 본사(HEADQUARTERS) 상품: [숫자] 형식 (예: [33], [1], [125])
 * 센터(CENTER) 상품: [Cxx-xxx] 형식 (예: [C01-001], [C12-099])
 */

// 본사 상품 코드: [숫자] — 대괄호 안에 1~4자리 숫자
const HQ_CODE_REGEX = /^\[\d{1,4}\]$/;

// 센터 상품 코드: [Cxx-xxx] — C + 2자리 숫자 + - + 3자리 숫자
const CENTER_CODE_REGEX = /^\[C\d{2}-\d{3}\]$/;

export function validateProductCode(
  code: string,
  productType: "HEADQUARTERS" | "CENTER"
): { valid: boolean; message: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, message: "상품코드를 입력하세요" };
  }

  const trimmed = code.trim();

  if (productType === "HEADQUARTERS") {
    if (!HQ_CODE_REGEX.test(trimmed)) {
      return {
        valid: false,
        message: "본사 상품코드는 [숫자] 형식이어야 합니다 (예: [33])",
      };
    }
  } else {
    if (!CENTER_CODE_REGEX.test(trimmed)) {
      return {
        valid: false,
        message: "센터 상품코드는 [Cxx-xxx] 형식이어야 합니다 (예: [C01-001])",
      };
    }
  }

  return { valid: true, message: "" };
}

/**
 * 상품코드 형식 힌트 텍스트 반환
 */
export function getProductCodeHint(productType: "HEADQUARTERS" | "CENTER"): string {
  return productType === "HEADQUARTERS"
    ? "[숫자] 형식 (예: [33])"
    : "[Cxx-xxx] 형식 (예: [C01-001])";
}
