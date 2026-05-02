/**
 * ONEWMS Stock Conflict 일괄 해결 스크립트
 *
 * 사용법:
 *   npx tsx scripts/resolve-stock-conflicts.ts              → 사전 검증 + 백업만
 *   npx tsx scripts/resolve-stock-conflicts.ts --dry-run    → dry-run (변경 없음)
 *   npx tsx scripts/resolve-stock-conflicts.ts --apply      → 실제 적용
 *
 * 1) 미해결 conflict 현황 파악 (DISTINCT ON productId, 최신 기록)
 * 2) 각 conflict의 localQty, availableQty(ONEWMS), 차이 분석
 * 3) 백업 JSON 생성 (backups/conflict-resolution-{timestamp}.json)
 * 4) --apply 시 ONEWMS 값으로 totalStock 업데이트 + AuditLog 기록 + syncStatus='resolved'
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

interface ConflictRecord {
  id: string;
  productId: string;
  productCode: string;
  availableQty: number;  // ONEWMS value
  localQty: number;      // DB value
  difference: number;
  syncedAt: Date;
}

interface ProductInfo {
  id: string;
  code: string | null;
  name: string | null;
  barcode: string | null;
  totalStock: number;
  isActive: boolean;
  onewmsCode: string | null;
}

interface ConflictDetail {
  conflictId: string;
  productId: string;
  code: string;
  barcode: string;
  name: string;
  dbStock: number;
  localQtyAtSync: number;
  onewmsQty: number;
  diff: number;
  isActive: boolean;
  warning: string;
}

// ── Step 1: 사전 검증 ──
async function preVerify() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ONEWMS Stock Conflict 일괄 해결");
  console.log("  실행 시각:", new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. 미해결 conflict 수
  const totalConflictRecords = await prisma.onewmsStockSync.count({
    where: { syncStatus: "conflict" },
  });
  console.log(`── Step 1: 사전 검증 ──`);
  console.log(`  전체 conflict 레코드: ${totalConflictRecords}건`);

  // 2. DISTINCT ON productId로 최신 conflict만 추출 (raw SQL)
  const latestConflicts = await prisma.$queryRaw<ConflictRecord[]>`
    SELECT DISTINCT ON ("productId")
      id, "productId", "productCode", "availableQty", "localQty", difference, "syncedAt"
    FROM "OnewmsStockSync"
    WHERE "syncStatus" = 'conflict'
    ORDER BY "productId", "syncedAt" DESC
  `;
  console.log(`  고유 상품 기준 conflict: ${latestConflicts.length}건`);

  // 3. 각 상품 정보 조회
  const productIds = latestConflicts.map((c) => c.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      code: true,
      name: true,
      barcode: true,
      totalStock: true,
      isActive: true,
      onewmsCode: true,
    },
  });
  const productMap = new Map<string, ProductInfo>(products.map((p) => [p.id, p]));

  // 4. 분석
  let dbZeroCount = 0;
  let largeDiffCount = 0;
  let inactiveCount = 0;
  let orphanCount = 0;
  const LARGE_THRESHOLD = 10000;
  const details: ConflictDetail[] = [];

  for (const c of latestConflicts) {
    const p = productMap.get(c.productId);
    const warning: string[] = [];

    if (!p) {
      orphanCount++;
      warning.push("상품 삭제됨");
    }
    if (p && !p.isActive) {
      inactiveCount++;
      warning.push("비활성");
    }
    if (p && p.totalStock === 0 && c.availableQty > 0) {
      dbZeroCount++;
    }
    if (Math.abs(c.difference) > LARGE_THRESHOLD) {
      largeDiffCount++;
      warning.push(`큰차이>${LARGE_THRESHOLD}`);
    }

    details.push({
      conflictId: c.id,
      productId: c.productId,
      code: p?.code || "-",
      barcode: p?.barcode || "-",
      name: (p?.name || "삭제된 상품").substring(0, 25),
      dbStock: p?.totalStock ?? -1,
      localQtyAtSync: c.localQty,
      onewmsQty: c.availableQty,
      diff: c.difference,
      isActive: p?.isActive ?? false,
      warning: warning.join(", "),
    });
  }

  // 차이 큰 순 정렬
  details.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  console.log(`\n  DB=0 (ONEWMS>0): ${dbZeroCount}건`);
  console.log(`  차이 >${LARGE_THRESHOLD}: ${largeDiffCount}건`);
  console.log(`  비활성 상품: ${inactiveCount}건`);
  console.log(`  삭제된 상품 (orphan): ${orphanCount}건`);

  // 상위 20건 출력
  console.log(`\n── 상위 ${Math.min(details.length, 20)}건 (차이 큰 순) ──\n`);
  console.log(
    "  " +
      "코드".padEnd(12) +
      "바코드".padEnd(16) +
      "상품명".padEnd(27) +
      "DB현재".padStart(8) +
      "WMS값".padStart(8) +
      "차이".padStart(8) +
      "  경고"
  );
  console.log("  " + "-".repeat(90));

  for (const d of details.slice(0, 20)) {
    const diffStr = d.diff > 0 ? `+${d.diff}` : String(d.diff);
    console.log(
      "  " +
        d.code.padEnd(12) +
        d.barcode.padEnd(16) +
        d.name.padEnd(27) +
        String(d.dbStock).padStart(8) +
        String(d.onewmsQty).padStart(8) +
        diffStr.padStart(8) +
        (d.warning ? `  ${d.warning}` : "")
    );
  }

  if (details.length > 20) {
    console.log(`  ... 그 외 ${details.length - 20}건`);
  }

  return { latestConflicts, details, totalConflictRecords, productMap };
}

// ── Step 2: 백업 생성 ──
async function createBackup(
  details: ConflictDetail[],
  totalConflictRecords: number
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `conflict-resolution-${timestamp}.json`);

  const backup = {
    createdAt: new Date().toISOString(),
    totalConflictRecords,
    uniqueProducts: details.length,
    details: details.map((d) => ({
      conflictId: d.conflictId,
      productId: d.productId,
      code: d.code,
      barcode: d.barcode,
      name: d.name,
      beforeTotalStock: d.dbStock,
      afterTotalStock: d.onewmsQty,
      localQtyAtSync: d.localQtyAtSync,
      diff: d.diff,
      isActive: d.isActive,
    })),
  };

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");
  console.log(`\n  백업 생성: ${backupPath}`);
  return backupPath;
}

// ── Step 3: dry-run ──
async function dryRun(details: any[]) {
  console.log("\n── DRY RUN ──");
  console.log("  실제 DB 변경 없이 적용 계획만 출력합니다.\n");

  let applyCount = 0;
  let skipCount = 0;

  for (const d of details) {
    if (!d.isActive) {
      skipCount++;
      continue;
    }
    if (d.dbStock === -1) {
      skipCount++; // 삭제된 상품
      continue;
    }
    applyCount++;
  }

  console.log(`  적용 예정: ${applyCount}건 (활성 상품, ONEWMS 값으로 갱신)`);
  console.log(`  건너뛸 상품: ${skipCount}건 (비활성 또는 삭제)`);
  console.log(`\n  [DRY RUN] 실제 적용하려면: npx tsx scripts/resolve-stock-conflicts.ts --apply`);
}

// ── Step 4: 실제 적용 ──
async function applyResolution(
  latestConflicts: ConflictRecord[],
  details: any[],
  productMap: Map<string, ProductInfo>
) {
  console.log("\n── 실제 적용 ──");

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const d of details) {
    // 비활성 또는 삭제된 상품은 conflict만 resolved 처리
    if (!d.isActive || d.dbStock === -1) {
      try {
        await prisma.onewmsStockSync.updateMany({
          where: {
            productId: d.productId,
            syncStatus: "conflict",
          },
          data: { syncStatus: "resolved" },
        });
        skipped++;
      } catch (e: any) {
        console.error(`  ❌ conflict resolved 실패 (skip): ${d.code} — ${e.message}`);
        errors++;
      }
      continue;
    }

    try {
      // 트랜잭션: product 업데이트 + conflict resolved + AuditLog
      await prisma.$transaction([
        prisma.product.update({
          where: { id: d.productId },
          data: { totalStock: d.onewmsQty },
        }),
        prisma.onewmsStockSync.updateMany({
          where: {
            productId: d.productId,
            syncStatus: "conflict",
          },
          data: { syncStatus: "resolved" },
        }),
        prisma.auditLog.create({
          data: {
            userId: null,
            userName: "시스템",
            userRole: "MASTER",
            action: "UPDATE",
            entityType: "Product",
            entityId: d.productId,
            entityName: `${d.barcode} (${d.name})`,
            before: { totalStock: d.dbStock },
            after: { totalStock: d.onewmsQty },
            diff: {
              totalStock: { from: d.dbStock, to: d.onewmsQty },
              reason: "onewms_conflict_bulk_resolution",
            },
            ipAddress: "script",
            userAgent: "resolve-stock-conflicts/1.0",
            description: `ONEWMS conflict 일괄 해결: ${d.dbStock} → ${d.onewmsQty} (차이: ${d.diff})`,
          },
        }),
      ]);
      success++;

      if (success % 20 === 0) {
        console.log(`  진행: ${success}/${details.length}...`);
      }
    } catch (e: any) {
      console.error(`  ❌ ${d.code}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n  완료: 적용 ${success}건, 건너뜀 ${skipped}건, 오류 ${errors}건`);

  // 사후 검증
  console.log("\n── 사후 검증 ──");
  const remainingConflicts = await prisma.onewmsStockSync.count({
    where: { syncStatus: "conflict" },
  });
  console.log(`  남은 미해결 conflict: ${remainingConflicts}건`);

  const resolvedCount = await prisma.onewmsStockSync.count({
    where: { syncStatus: "resolved" },
  });
  console.log(`  총 resolved 레코드: ${resolvedCount}건`);

  // AuditLog 확인
  const recentAuditLogs = await prisma.auditLog.count({
    where: {
      action: "UPDATE",
      description: { contains: "conflict 일괄 해결" },
      createdAt: { gte: new Date(Date.now() - 300000) }, // 최근 5분
    },
  });
  console.log(`  생성된 AuditLog: ${recentAuditLogs}건`);
}

// ── 메인 ──
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isApply = args.includes("--apply");

  const { latestConflicts, details, totalConflictRecords, productMap } = await preVerify();

  // 항상 백업 생성
  await createBackup(details, totalConflictRecords);

  if (isDryRun) {
    await dryRun(details);
  } else if (isApply) {
    await applyResolution(latestConflicts, details, productMap);
  } else {
    console.log("\n  사전 검증 + 백업 완료.");
    console.log("  dry-run: npx tsx scripts/resolve-stock-conflicts.ts --dry-run");
    console.log("  실제 적용: npx tsx scripts/resolve-stock-conflicts.ts --apply");
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("스크립트 오류:", e);
  process.exit(1);
});
