/**
 * ONEWMS vs DB 재고 불일치 전체 감사 스크립트
 *
 * 사용법: npx tsx scripts/audit-stock-discrepancy.ts
 *
 * 1) DB에서 onewmsCode가 있는 모든 활성 상품 조회
 * 2) ONEWMS supply_code 기반으로 전체 재고 일괄 조회
 * 3) DB totalStock vs ONEWMS 합산 재고 비교
 * 4) 불일치 상품 리스트 + 통계 출력
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

const ONEWMS_API_URL = process.env.ONEWMS_API_URL || "https://api.onewms.co.kr/api.php";
const ONEWMS_PARTNER_KEY = process.env.ONEWMS_PARTNER_KEY!;
const ONEWMS_DOMAIN_KEY = process.env.ONEWMS_DOMAIN_KEY!;

interface StockEntry {
  product_id: string;
  link_id?: string;
  barcode?: string;
  stock: Record<string, { warehouse_seq: string; stock: string | number }>;
}

// ── ONEWMS API 호출 ──
async function onewmsRequest(action: string, params: Record<string, string> = {}): Promise<any> {
  const formData = new URLSearchParams({
    partner_key: ONEWMS_PARTNER_KEY,
    domain_key: ONEWMS_DOMAIN_KEY,
    action,
    ...params,
  });

  const res = await fetch(ONEWMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!res.ok) throw new Error(`ONEWMS HTTP ${res.status}`);
  return res.json();
}

// ── ONEWMS 전체 재고 맵 구축 ──
async function fetchAllOnewmsStock(): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  // 방법 1: supply_code=20217 (올바른영양) 로 페이지네이션 조회
  console.log("  ONEWMS 재고 일괄 조회 중 (supply_code 방식)...");

  for (let page = 1; page <= 30; page++) {
    const res = await onewmsRequest("get_stock_info", {
      type: "supply_code",
      ids: "20217",
      page: String(page),
      limit: "100",
    });

    const data = res.data || {};
    const entries = Object.entries(data) as [string, StockEntry][];

    // supply_code 응답에서 pagination 메타 필드 제거
    const metaKeys = new Set(["total", "page", "limit"]);
    let productCount = 0;

    for (const [key, entry] of entries) {
      if (metaKeys.has(key)) continue;
      if (!entry || typeof entry !== "object" || !entry.stock) continue;

      // 모든 창고 재고 합산
      let totalStock = 0;
      for (const wh of Object.values(entry.stock)) {
        totalStock += Number(wh.stock) || 0;
      }
      stockMap.set(key, totalStock);
      productCount++;
    }

    console.log(`    page ${page}: ${productCount}개 상품`);

    const total = Number(data.total) || 0;
    if (page * 100 >= total || productCount === 0) break;

    // Rate limit 방지
    await new Promise((r) => setTimeout(r, 500));
  }

  // 방법 2: supply_code로 못 가져온 상품은 개별 조회
  // (다른 화주의 상품이 있을 수 있음)
  return stockMap;
}

// ── 개별 상품 ONEWMS 조회 (supply_code에 없는 상품용) ──
async function fetchIndividualStock(onewmsCode: string): Promise<number> {
  try {
    const res = await onewmsRequest("get_stock_info", {
      type: "product_id",
      ids: onewmsCode,
    });

    const data = res.data || {};
    const entry = data[onewmsCode];
    if (!entry?.stock) return -1; // -1 = ONEWMS에 없음

    let total = 0;
    for (const wh of Object.values(entry.stock) as any[]) {
      total += Number(wh.stock) || 0;
    }
    return total;
  } catch {
    return -1;
  }
}

// ── DB 최근 동기화 이력 ──
async function getLastSyncInfo(): Promise<{ lastSync: Date | null; syncCount: number; conflictCount: number }> {
  const lastSync = await prisma.onewmsStockSync.findFirst({
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySyncs = await prisma.onewmsStockSync.count({
    where: { syncedAt: { gte: today } },
  });

  const unresolvedConflicts = await prisma.onewmsStockSync.count({
    where: { syncStatus: "conflict" },
  });

  return {
    lastSync: lastSync?.syncedAt || null,
    syncCount: todaySyncs,
    conflictCount: unresolvedConflicts,
  };
}

// ── 메인 ──
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ONEWMS vs DB 재고 불일치 전체 감사");
  console.log("  실행 시각:", new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. 동기화 이력 확인
  console.log("── Step 1: 최근 동기화 이력 ──");
  const syncInfo = await getLastSyncInfo();
  console.log(`  마지막 동기화: ${syncInfo.lastSync?.toISOString() || "없음"}`);
  console.log(`  오늘 동기화 횟수: ${syncInfo.syncCount}`);
  console.log(`  미해결 충돌: ${syncInfo.conflictCount}건`);

  // 2. DB 상품 조회
  console.log("\n── Step 2: DB 상품 조회 ──");
  const dbProducts = await prisma.product.findMany({
    where: {
      onewmsCode: { not: null },
      productType: "HEADQUARTERS",
    },
    select: {
      id: true,
      code: true,
      barcode: true,
      name: true,
      onewmsCode: true,
      totalStock: true,
      isActive: true,
      updatedAt: true,
    },
    orderBy: { code: "asc" },
  });

  const activeProducts = dbProducts.filter((p) => p.isActive);
  const inactiveProducts = dbProducts.filter((p) => !p.isActive);

  console.log(`  전체 HQ 상품 (onewmsCode 있음): ${dbProducts.length}개`);
  console.log(`  활성: ${activeProducts.length}개, 비활성: ${inactiveProducts.length}개`);

  // 3. ONEWMS 재고 일괄 조회
  console.log("\n── Step 3: ONEWMS 재고 조회 ──");
  const onewmsStockMap = await fetchAllOnewmsStock();
  console.log(`  ONEWMS 재고 조회 완료: ${onewmsStockMap.size}개 상품`);

  // 4. 개별 조회 필요한 상품 확인
  const missingFromBulk: typeof activeProducts = [];
  for (const p of activeProducts) {
    if (!onewmsStockMap.has(p.onewmsCode!)) {
      missingFromBulk.push(p);
    }
  }

  if (missingFromBulk.length > 0) {
    console.log(`\n  supply_code 일괄 조회에 없는 상품: ${missingFromBulk.length}개 → 개별 조회`);
    let batchIdx = 0;
    for (const p of missingFromBulk) {
      const stock = await fetchIndividualStock(p.onewmsCode!);
      if (stock >= 0) {
        onewmsStockMap.set(p.onewmsCode!, stock);
      }
      batchIdx++;
      if (batchIdx % 20 === 0) {
        console.log(`    ${batchIdx}/${missingFromBulk.length} 조회 완료`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    console.log(`    개별 조회 완료: ${missingFromBulk.length}개`);
  }

  // 5. 비교
  console.log("\n── Step 4: DB vs ONEWMS 비교 ──");

  interface Discrepancy {
    code: string;
    barcode: string;
    name: string;
    dbStock: number;
    onewmsStock: number;
    diff: number;
    onewmsCode: string;
    lastUpdated: string;
  }

  const discrepancies: Discrepancy[] = [];
  let matchCount = 0;
  let notInOnewms = 0;

  for (const p of activeProducts) {
    const onewmsStock = onewmsStockMap.get(p.onewmsCode!);

    if (onewmsStock === undefined) {
      notInOnewms++;
      continue;
    }

    const diff = onewmsStock - p.totalStock;
    if (diff !== 0) {
      discrepancies.push({
        code: p.code || "-",
        barcode: p.barcode || "-",
        name: (p.name || "").substring(0, 30),
        dbStock: p.totalStock,
        onewmsStock,
        diff,
        onewmsCode: p.onewmsCode!,
        lastUpdated: p.updatedAt.toISOString().substring(0, 19),
      });
    } else {
      matchCount++;
    }
  }

  // 6. 결과 출력
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  결과 요약");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log(`  대상 상품: ${activeProducts.length}개 (활성 HQ, onewmsCode 있음)`);
  console.log(`  ✅ 일치: ${matchCount}개`);
  console.log(`  ❌ 불일치: ${discrepancies.length}개`);
  console.log(`  ⬜ ONEWMS에 없음: ${notInOnewms}개`);
  console.log(`  일치율: ${activeProducts.length > 0 ? ((matchCount / (activeProducts.length - notInOnewms)) * 100).toFixed(1) : 0}%`);

  if (discrepancies.length > 0) {
    // 차이 큰 순 정렬
    discrepancies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    console.log(`\n── 불일치 상위 ${Math.min(discrepancies.length, 20)}건 (차이 큰 순) ──\n`);
    console.log(
      "  " +
        "코드".padEnd(12) +
        "바코드".padEnd(16) +
        "상품명".padEnd(32) +
        "DB재고".padStart(8) +
        "WMS재고".padStart(8) +
        "차이".padStart(8)
    );
    console.log("  " + "-".repeat(84));

    for (const d of discrepancies.slice(0, 20)) {
      const diffStr = d.diff > 0 ? `+${d.diff}` : String(d.diff);
      console.log(
        "  " +
          (d.code || "-").padEnd(12) +
          (d.barcode || "-").padEnd(16) +
          d.name.padEnd(32) +
          String(d.dbStock).padStart(8) +
          String(d.onewmsStock).padStart(8) +
          diffStr.padStart(8)
      );
    }

    if (discrepancies.length > 20) {
      console.log(`  ... 그 외 ${discrepancies.length - 20}건`);
    }

    // 패턴 분석
    console.log("\n── 패턴 분석 ──");
    const dbHigher = discrepancies.filter((d) => d.diff < 0);
    const onewmsHigher = discrepancies.filter((d) => d.diff > 0);
    const bigDiff = discrepancies.filter((d) => Math.abs(d.diff) > 50);

    console.log(`  DB > ONEWMS (DB가 더 큼): ${dbHigher.length}건`);
    console.log(`  ONEWMS > DB (ONEWMS가 더 큼): ${onewmsHigher.length}건`);
    console.log(`  차이 50개 초과: ${bigDiff.length}건`);

    const totalDiscrepancyRate = (discrepancies.length / (activeProducts.length - notInOnewms)) * 100;
    if (totalDiscrepancyRate > 50) {
      console.log("\n  패턴 A: 전체의 50% 이상 불일치 → cron 미작동 또는 전면 동기화 실패 의심");
    } else if (totalDiscrepancyRate > 10) {
      console.log("\n  패턴 B: 10~50% 불일치 → 부분적 동기화 문제 (특정 카테고리/배치 실패)");
    } else if (discrepancies.length <= 5) {
      console.log("\n  패턴 C: 소수 불일치 → 개별 케이스 (수동 재고 수정 또는 출고 타이밍)");
    } else {
      console.log("\n  패턴 B-C: 제한적 불일치 → 최근 재고 변동 또는 동기화 주기 차이");
    }
  } else {
    console.log("\n  패턴 D: 모든 상품 일치 → 코드 정상, 캐시된 화면 또는 타이밍 문제 가능");
  }

  // 7. ONEWMS에 없는 상품 샘플
  if (notInOnewms > 0) {
    const missing = activeProducts.filter((p) => !onewmsStockMap.has(p.onewmsCode!));
    console.log(`\n── ONEWMS에 없는 상품 (상위 5건) ──`);
    for (const p of missing.slice(0, 5)) {
      console.log(`  onewmsCode=${p.onewmsCode}, code=${p.code}, name=${p.name?.substring(0, 30)}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("스크립트 오류:", e);
  process.exit(1);
});
