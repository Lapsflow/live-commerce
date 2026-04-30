/**
 * Deactivate orphan HEADQUARTERS products not found in ONEWMS.
 * Also restores products that reappear in ONEWMS.
 *
 * Rules:
 * - Only affects productType=HEADQUARTERS with onewmsCode
 * - CENTER products are NEVER touched
 * - Products not in ONEWMS → isActive=false
 * - Previously deactivated products found in ONEWMS → isActive=true (restore)
 * - All changes logged to AuditLog
 *
 * Usage:
 *   npx tsx scripts/deactivate-orphan-products.ts --dry-run   (preview)
 *   npx tsx scripts/deactivate-orphan-products.ts              (apply)
 */
import dotenv from "dotenv";
dotenv.config();

import { PrismaClient, Prisma } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon({ connectionString: connStr } as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const API_URL = process.env.ONEWMS_API_URL || "https://api.onewms.co.kr/api.php";
const PARTNER_KEY = process.env.ONEWMS_PARTNER_KEY || "";
const DOMAIN_KEY = process.env.ONEWMS_DOMAIN_KEY || "";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Orphan Product Check ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Fetch all ONEWMS product IDs
  const onewmsProductIds = new Set<string>();

  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      partner_key: PARTNER_KEY,
      domain_key: DOMAIN_KEY,
      action: "get_product_info",
      page: String(page),
      limit: "100",
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const json = await res.json() as { data?: Array<{ product_id?: string }>; total?: number };
    if (!json.data) break;

    for (const p of json.data) {
      if (p.product_id) onewmsProductIds.add(p.product_id);
    }

    if (page * 100 >= (json.total || 0)) break;
    process.stdout.write(`\r  Fetching ONEWMS products: page ${page}...`);
  }

  console.log(`\n  ONEWMS product IDs: ${onewmsProductIds.size}\n`);

  // 2. Get all HEADQUARTERS products from DB
  const hqProducts = await prisma.product.findMany({
    where: {
      productType: "HEADQUARTERS",
      onewmsCode: { not: null },
    },
    select: { id: true, code: true, name: true, barcode: true, onewmsCode: true, isActive: true },
  });

  // Count CENTER products for safety check
  const centerCount = await prisma.product.count({ where: { productType: "CENTER" } });

  console.log(`  DB HEADQUARTERS (onewmsCode): ${hqProducts.length}`);
  console.log(`  DB CENTER (not touched):      ${centerCount}\n`);

  // 3. Classify
  const toDeactivate: typeof hqProducts = [];
  const toRestore: typeof hqProducts = [];
  let alreadyCorrect = 0;

  for (const product of hqProducts) {
    const existsInOnewms = onewmsProductIds.has(product.onewmsCode!);

    if (!existsInOnewms && product.isActive) {
      toDeactivate.push(product);
    } else if (existsInOnewms && !product.isActive) {
      toRestore.push(product);
    } else {
      alreadyCorrect++;
    }
  }

  console.log(`${"─".repeat(60)}`);
  console.log(`  Results`);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Already correct:  ${alreadyCorrect}`);
  console.log(`  To deactivate:    ${toDeactivate.length} (orphan — not in ONEWMS)`);
  console.log(`  To restore:       ${toRestore.length} (reappeared in ONEWMS)`);
  console.log();

  if (toDeactivate.length > 0) {
    console.log(`  Orphan products (will be deactivated):`);
    for (const p of toDeactivate.slice(0, 20)) {
      console.log(`    ${p.barcode.padEnd(18)} ${p.code.padEnd(12)} ${p.name.slice(0, 40)}`);
    }
    if (toDeactivate.length > 20) {
      console.log(`    ... and ${toDeactivate.length - 20} more`);
    }
    console.log();
  }

  if (toRestore.length > 0) {
    console.log(`  Restored products (reappeared in ONEWMS):`);
    for (const p of toRestore) {
      console.log(`    ${p.barcode.padEnd(18)} ${p.code.padEnd(12)} ${p.name.slice(0, 40)}`);
    }
    console.log();
  }

  if (DRY_RUN) {
    console.log("DRY RUN — no changes applied. Remove --dry-run to apply.\n");
    return;
  }

  // 4. Apply changes
  let deactivated = 0;
  let restored = 0;

  for (const product of toDeactivate) {
    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: null,
        userName: "시스템",
        userRole: "MASTER",
        action: "UPDATE",
        entityType: "PRODUCT",
        entityId: product.id,
        entityName: `${product.barcode} (${product.name})`,
        before: { isActive: true } as Prisma.InputJsonValue,
        after: { isActive: false } as Prisma.InputJsonValue,
        diff: { isActive: { from: true, to: false }, reason: "onewms_orphan" } as unknown as Prisma.InputJsonValue,
        ipAddress: "localhost",
        userAgent: "deactivate-orphan-products/1.0",
        description: "ONEWMS에서 삭제된 본사 상품 자동 비활성화",
      },
    });

    deactivated++;
  }

  for (const product of toRestore) {
    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: null,
        userName: "시스템",
        userRole: "MASTER",
        action: "UPDATE",
        entityType: "PRODUCT",
        entityId: product.id,
        entityName: `${product.barcode} (${product.name})`,
        before: { isActive: false } as Prisma.InputJsonValue,
        after: { isActive: true } as Prisma.InputJsonValue,
        diff: { isActive: { from: false, to: true }, reason: "onewms_restored" } as unknown as Prisma.InputJsonValue,
        ipAddress: "localhost",
        userAgent: "deactivate-orphan-products/1.0",
        description: "ONEWMS에 다시 나타난 본사 상품 자동 복구",
      },
    });

    restored++;
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`  Complete: ${deactivated} deactivated, ${restored} restored`);
  console.log(`  AuditLog entries: ${deactivated + restored}`);
  console.log(`${"═".repeat(60)}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
