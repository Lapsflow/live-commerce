import { prisma } from "@/lib/db/prisma";

/**
 * 센터 상품용 바코드 자동 생성
 * 형식: CTR-{centerCode}-{4자리 시퀀스}
 * 예: CTR-01-0001, CTR-15-0042
 */
export async function generateCenterBarcode(centerCode: string): Promise<string> {
  const prefix = `CTR-${centerCode}-`;

  // 해당 센터의 마지막 바코드 시퀀스 조회
  const lastProduct = await prisma.product.findFirst({
    where: {
      barcode: { startsWith: prefix },
    },
    orderBy: { barcode: "desc" },
    select: { barcode: true },
  });

  let nextSeq = 1;
  if (lastProduct?.barcode) {
    const seqPart = lastProduct.barcode.slice(prefix.length);
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * 여러 개의 바코드를 한번에 생성 (배치용)
 */
export async function generateCenterBarcodes(
  centerCode: string,
  count: number
): Promise<string[]> {
  const prefix = `CTR-${centerCode}-`;

  const lastProduct = await prisma.product.findFirst({
    where: {
      barcode: { startsWith: prefix },
    },
    orderBy: { barcode: "desc" },
    select: { barcode: true },
  });

  let nextSeq = 1;
  if (lastProduct?.barcode) {
    const seqPart = lastProduct.barcode.slice(prefix.length);
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return Array.from({ length: count }, (_, i) =>
    `${prefix}${String(nextSeq + i).padStart(4, "0")}`
  );
}
