/**
 * Manual Stock Sync: Immediately sync all ONEWMS-linked products' totalStock.
 * Shows before/after comparison and creates AuditLog entries for changes.
 *
 * Usage: npx tsx scripts/manual-stock-sync.ts
 *        npx tsx scripts/manual-stock-sync.ts --dry-run  (preview only)
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

interface StockChange {
  productId: string;
  code: string;
  name: string;
  barcode: string;
  onewmsCode: string;
  before: number;
  after: number;
  diff: number;
}

async function callOnewms(action: string, extraParams: Record<string, string> = {}): Promise<unknown> {
  const params = new URLSearchParams({
    partner_key: PARTNER_KEY,
    domain_key: DOMAIN_KEY,
    action,
    ...extraParams,
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  return res.json();
}

async function getOnewmsStock(onewmsCode: string): Promise<number> {
  const response = await callOnewms("get_stock_info", {
    type: "product_id",
    ids: onewmsCode,
  }) as { data?: Record<string, { stock?: Record<string, { stock?: string | number }> }> };

  if (!response.data) return 0;

  const entry = response.data[onewmsCode];
  if (!entry?.stock) return 0;

  let total = 0;
  for (const wh of Object.values(entry.stock)) {
    total += Number(wh.stock) || 0;
  }
  return total;
}

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Manual Stock Sync ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Get all products with onewmsCode
  const products = await prisma.product.findMany({
    where: { onewmsCode: { not: null } },
    select: { id: true, code: true, name: true, barcode: true, onewmsCode: true, totalStock: true },
    orderBy: { code: "asc" },
  });

  console.log(`Total products with onewmsCode: ${products.length}\n`);

  const changes: StockChange[] = [];
  const errors: Array<{ code: string; error: string }> = [];
  let unchanged = 0;

  // 2. Fetch ONEWMS stock for each product (batch of 5)
  const batchSize = 5;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (product) => {
        try {
          const onewmsStock = await getOnewmsStock(product.onewmsCode!);
          return { product, onewmsStock, error: null };
        } catch (err) {
          return { product, onewmsStock: 0, error: err instanceof Error ? err.message : "Unknown" };
        }
      })
    );

    for (const { product, onewmsStock, error } of results) {
      if (error) {
        errors.push({ code: product.code, error });
        continue;
      }

      if (onewmsStock !== product.totalStock) {
        changes.push({
          productId: product.id,
          code: product.code,
          name: product.name,
          barcode: product.barcode,
          onewmsCode: product.onewmsCode!,
          before: product.totalStock,
          after: onewmsStock,
          diff: onewmsStock - product.totalStock,
        });
      } else {
        unchanged++;
      }
    }

    // Progress
    const processed = Math.min(i + batchSize, products.length);
    process.stdout.write(`\r  Progress: ${processed}/${products.length}`);

    // Rate limit delay
    if (i + batchSize < products.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("\n");

  // 3. Report
  console.log(`${"─".repeat(60)}`);
  console.log(`  Results`);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  Changed:    ${changes.length}`);
  console.log(`  Errors:     ${errors.length}`);
  console.log();

  if (changes.length > 0) {
    console.log(`${"─".repeat(60)}`);
    console.log(`  Changes (before → after)`);
    console.log(`${"─".repeat(60)}`);
    for (const c of changes) {
      const sign = c.diff > 0 ? "+" : "";
      console.log(`  ${c.barcode.padEnd(16)} ${String(c.before).padStart(8)} → ${String(c.after).padStart(8)}  (${sign}${c.diff})  ${c.name.slice(0, 30)}`);
    }
    console.log();
  }

  if (errors.length > 0) {
    console.log(`${"─".repeat(60)}`);
    console.log(`  Errors`);
    console.log(`${"─".repeat(60)}`);
    for (const e of errors) {
      console.log(`  ${e.code}: ${e.error}`);
    }
    console.log();
  }

  // 4. Apply changes (unless dry run)
  if (DRY_RUN) {
    console.log("DRY RUN — no changes applied. Remove --dry-run to apply.\n");
    return;
  }

  if (changes.length === 0) {
    console.log("No changes needed. All stock values are in sync.\n");
    return;
  }

  console.log(`Applying ${changes.length} stock updates...\n`);

  let applied = 0;
  for (const c of changes) {
    try {
      await prisma.product.update({
        where: { id: c.productId },
        data: { totalStock: c.after },
      });

      await prisma.auditLog.create({
        data: {
          userId: null,
          userName: "시스템",
          userRole: "MASTER",
          action: "UPDATE",
          entityType: "PRODUCT",
          entityId: c.productId,
          entityName: `${c.barcode} (${c.name})`,
          before: { totalStock: c.before } as Prisma.InputJsonValue,
          after: { totalStock: c.after } as Prisma.InputJsonValue,
          diff: {
            totalStock: { from: c.before, to: c.after, diff: c.diff },
          } as unknown as Prisma.InputJsonValue,
          ipAddress: "localhost",
          userAgent: "manual-stock-sync/1.0",
          description: "ONEWMS 재고 수동 동기화 (String→Number 버그 수정 후)",
        },
      });

      applied++;
    } catch (err) {
      console.error(`  Failed to update ${c.barcode}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`  Sync Complete: ${applied}/${changes.length} products updated`);
  console.log(`  AuditLog entries created: ${applied}`);
  console.log(`${"═".repeat(60)}\n`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
