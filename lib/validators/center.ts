/**
 * 센터 코드 형식 검증
 * 형식: [지역코드]-[센터 대표자 휴대폰 뒷 4자리]
 * 예: 01-4213, 02-3413, 14-6521
 */

export const REGION_CODES = {
  '01': '서울',
  '02': '경기',
  '03': '인천',
  '04': '부산',
  '05': '대구',
  '06': '대전',
  '07': '광주',
  '08': '울산',
  '09': '세종',
  '10': '강원',
  '11': '충북',
  '12': '충남',
  '13': '전북',
  '14': '전남',
  '15': '경북',
  '16': '경남',
  '17': '제주',
} as const;

export type RegionCode = keyof typeof REGION_CODES;

/**
 * 센터 코드 형식 검증
 * @param code 센터 코드 (예: "01-4213")
 * @returns 유효하면 true, 아니면 false
 */
export function validateCenterCode(code: string): boolean {
  // 형식: [01-17]-[4자리 숫자]
  const regex = /^(0[1-9]|1[0-7])-\d{4}$/;
  return regex.test(code);
}

/**
 * 센터 코드 생성
 * @param regionCode 지역 코드 (01~17)
 * @param phoneLast4 센터 대표자 휴대폰 뒷 4자리
 * @returns 생성된 센터 코드
 */
export function generateCenterCode(
  regionCode: RegionCode,
  phoneLast4: string
): string {
  if (phoneLast4.length !== 4 || !/^\d{4}$/.test(phoneLast4)) {
    throw new Error('휴대폰 뒷 4자리는 숫자 4자리여야 합니다');
  }
  return `${regionCode}-${phoneLast4}`;
}

/**
 * 센터 코드에서 지역명 추출
 * @param code 센터 코드
 * @returns 지역명 (예: "서울")
 */
export function getRegionName(code: string): string {
  const regionCode = code.split('-')[0] as RegionCode;
  return REGION_CODES[regionCode] || '알 수 없음';
}
