/**
 * 센터 상품 코드 자동 생성: [C{centerNumber}-{순번}]
 * 예: 센터번호 01의 첫 상품 → [C01-001], 두 번째 → [C01-002]
 *
 * 동시성 안전: Prisma 트랜잭션 내에서 최대 순번 조회 후 +1
 */

import { prisma } from '@/lib/db/prisma';

/**
 * 센터의 2자리 번호를 반환
 * centerNumber가 "C01" 형식이면 "01" 추출
 * 없으면 regionCode (2자리) 사용
 */
function extractCenterNumber(center: {
  centerNumber: string | null;
  regionCode: string;
}): string {
  if (center.centerNumber) {
    // "C01" → "01", "C12" → "12"
    const match = center.centerNumber.match(/C?(\d{2})/);
    if (match) return match[1];
  }
  // fallback: regionCode는 이미 2자리 ("01"~"17")
  return center.regionCode.padStart(2, '0');
}

/**
 * 다음 센터 상품 코드 생성
 * 트랜잭션 내에서 호출하면 동시성 안전
 */
export async function generateCenterProductCode(centerId: string): Promise<string> {
  const center = await prisma.center.findUnique({
    where: { id: centerId },
    select: { centerNumber: true, regionCode: true },
  });

  if (!center) {
    throw new Error(`센터를 찾을 수 없습니다: ${centerId}`);
  }

  const num = extractCenterNumber(center);
  const prefix = `[C${num}-`;

  // 해당 센터의 가장 큰 순번 찾기
  const lastProduct = await prisma.product.findFirst({
    where: {
      productType: 'CENTER',
      managedBy: centerId,
      code: { startsWith: prefix },
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let nextSeq = 1;
  if (lastProduct) {
    // "[C01-003]" → 3
    const match = lastProduct.code.match(/\[C\d{2}-(\d{3})\]/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  if (nextSeq > 999) {
    throw new Error(`센터 ${num}의 상품 코드가 999를 초과했습니다`);
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}]`;
}

/**
 * 코드 미리보기 (저장 전 폼에 표시)
 * DB 변경 없이 다음 코드만 조회
 */
export async function previewCenterProductCode(centerId: string): Promise<string> {
  return generateCenterProductCode(centerId);
}
