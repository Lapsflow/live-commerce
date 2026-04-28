// lib/services/orders/productMatching.ts
// ORDER-01/02: 발주서 상품 자동 매칭 서비스
import { prisma } from "@/lib/db/prisma";

export interface MatchedItem {
  rowIndex: number;
  input: {
    code?: string;
    barcode?: string;
    productName?: string;
    quantity: number;
    totalAmount: number;
  };
  matched: boolean;
  matchMethod?: "CODE" | "BARCODE" | "NAME_EXACT" | "NAME_PARTIAL";
  product?: {
    id: string;
    code: string;
    name: string;
    barcode: string;
    supplyPrice: number;
    productType: string;
  };
  error?: string;
}

/**
 * 발주서 항목들을 DB 상품과 매칭
 *
 * 매칭 우선순위:
 * 1. 코드 패턴 [숫자] 또는 [Cxx-xxx] — code 필드 일치
 * 2. 바코드 완전일치
 * 3. 제품명 완전일치
 * 4. 제품명 부분일치 (contains)
 */
export async function matchOrderItems(
  items: Array<{
    code?: string;
    barcode?: string;
    productName?: string;
    quantity: number;
    totalAmount: number;
  }>
): Promise<MatchedItem[]> {
  const results: MatchedItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result: MatchedItem = {
      rowIndex: i,
      input: item,
      matched: false,
    };

    // 1순위: 코드 매칭 (예: [33], [C01-001])
    if (item.code) {
      const codeClean = item.code.replace(/[\[\]]/g, "").trim();
      if (codeClean) {
        const product = await prisma.product.findFirst({
          where: {
            code: { equals: codeClean, mode: "insensitive" },
            isActive: true,
          },
          select: {
            id: true, code: true, name: true, barcode: true,
            supplyPrice: true, productType: true,
          },
        });
        if (product) {
          result.matched = true;
          result.matchMethod = "CODE";
          result.product = product;
          results.push(result);
          continue;
        }
      }
    }

    // 2순위: 바코드 완전일치
    if (item.barcode) {
      const product = await prisma.product.findFirst({
        where: {
          barcode: item.barcode.trim(),
          isActive: true,
        },
        select: {
          id: true, code: true, name: true, barcode: true,
          supplyPrice: true, productType: true,
        },
      });
      if (product) {
        result.matched = true;
        result.matchMethod = "BARCODE";
        result.product = product;
        results.push(result);
        continue;
      }
    }

    // 3순위: 제품명 완전��치
    if (item.productName) {
      const nameClean = item.productName.trim();
      const product = await prisma.product.findFirst({
        where: {
          name: { equals: nameClean, mode: "insensitive" },
          isActive: true,
        },
        select: {
          id: true, code: true, name: true, barcode: true,
          supplyPrice: true, productType: true,
        },
      });
      if (product) {
        result.matched = true;
        result.matchMethod = "NAME_EXACT";
        result.product = product;
        results.push(result);
        continue;
      }

      // 4순위: 제품명 부분일치
      const partialProduct = await prisma.product.findFirst({
        where: {
          name: { contains: nameClean, mode: "insensitive" },
          isActive: true,
        },
        select: {
          id: true, code: true, name: true, barcode: true,
          supplyPrice: true, productType: true,
        },
      });
      if (partialProduct) {
        result.matched = true;
        result.matchMethod = "NAME_PARTIAL";
        result.product = partialProduct;
        results.push(result);
        continue;
      }
    }

    // 매칭 실패
    result.error = `상품을 찾을 수 없습니다: ${item.code || item.barcode || item.productName || "(정보 없음)"}`;
    results.push(result);
  }

  return results;
}
