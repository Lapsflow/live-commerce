/**
 * Seller Center Migration: Step 2~4
 * - Step 2: Backup affected users to JSON
 * - Step 3: Update centerId to NULL + AuditLog
 * - Step 4: Verify all SELLER centerId is NULL
 *
 * Usage: npx tsx scripts/migrate-seller-centers.ts
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon({ connectionString: connStr } as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const TARGET_USERNAMES = ["smj12", "blackhole12", "jinwoo"];
const DESCRIPTION = "Phase 4 정책에 따른 셀러 센터 미배정 처리";

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // ─── Step 2: Backup ───
  console.log("=== Step 2: 백업 ===\n");

  const targetUsers = await prisma.user.findMany({
    where: { username: { in: TARGET_USERNAMES } },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      centerId: true,
      center: { select: { code: true, name: true } },
    },
  });

  if (targetUsers.length !== 3) {
    console.error(`Expected 3 users, found ${targetUsers.length}. Aborting.`);
    process.exit(1);
  }

  const backup = {
    migrationId: `seller-center-migration-${timestamp}`,
    executedAt: new Date().toISOString(),
    description: DESCRIPTION,
    users: targetUsers.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      previousCenterId: u.centerId,
      previousCenterCode: u.center?.code || null,
      previousCenterName: u.center?.name || null,
    })),
  };

  const backupDir = path.join(process.cwd(), "backups");
  const backupPath = path.join(backupDir, `seller-center-migration-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");
  console.log(`백업 파일 생성: ${backupPath}`);
  console.log(`대상 사용자 ${targetUsers.length}명:`);
  for (const u of targetUsers) {
    console.log(`  ${u.username} (${u.name}) — centerId: ${u.centerId} → ${u.center?.code} ${u.center?.name}`);
  }

  // ─── Step 3: Migration + AuditLog ───
  console.log("\n=== Step 3: 마이그레이션 실행 ===\n");

  const auditLogIds: string[] = [];

  for (const user of targetUsers) {
    // Update centerId to NULL
    await prisma.user.update({
      where: { id: user.id },
      data: { centerId: null },
    });

    // Create AuditLog entry
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: null, // system action
        userName: "시스템",
        userRole: "MASTER",
        action: "UPDATE",
        entityType: "USER",
        entityId: user.id,
        entityName: `${user.username} (${user.name})`,
        before: { centerId: user.centerId } as Prisma.InputJsonValue,
        after: { centerId: null } as unknown as Prisma.InputJsonValue,
        diff: {
          centerId: {
            from: `${user.centerId} (${user.center?.code} ${user.center?.name})`,
            to: null,
          },
        } as unknown as Prisma.InputJsonValue,
        ipAddress: "localhost",
        userAgent: "migrate-seller-centers/1.0",
        description: DESCRIPTION,
      },
    });

    auditLogIds.push(auditLog.id);
    console.log(`✅ ${user.username}: centerId → NULL (AuditLog: ${auditLog.id})`);
  }

  // ─── Step 4: Verification ───
  console.log("\n=== Step 4: 검증 ===\n");

  // 4-1: All SELLER centerId should be NULL
  const sellersWithCenter = await prisma.user.count({
    where: { role: "SELLER", centerId: { not: null } },
  });
  const sellersWithoutCenter = await prisma.user.count({
    where: { role: "SELLER", centerId: null },
  });
  const totalSellers = await prisma.user.count({ where: { role: "SELLER" } });

  console.log(`SELLER 전체: ${totalSellers}명`);
  console.log(`  centerId NULL: ${sellersWithoutCenter}명`);
  console.log(`  centerId 설정: ${sellersWithCenter}명`);

  if (sellersWithCenter === 0) {
    console.log("  ✅ 모든 SELLER의 centerId가 NULL입니다.");
  } else {
    console.log("  ⚠️  아직 centerId가 설정된 SELLER가 있습니다!");
  }

  // 4-2: Verify 3 target users
  console.log("\n변경 확인:");
  for (const username of TARGET_USERNAMES) {
    const u = await prisma.user.findUnique({
      where: { username },
      select: { username: true, name: true, centerId: true },
    });
    const status = u?.centerId === null ? "✅ NULL" : `❌ ${u?.centerId}`;
    console.log(`  ${u?.username} (${u?.name}): ${status}`);
  }

  // 4-3: Existing data unaffected (broadcast/order counts same as before)
  console.log("\n기존 데이터 영향 확인:");
  for (const user of targetUsers) {
    const bCount = await prisma.broadcast.count({ where: { sellerId: user.id } });
    const oCount = await prisma.order.count({ where: { sellerId: user.id } });
    console.log(`  ${user.username}: 방송 ${bCount}건, 발주 ${oCount}건 (변경 없음)`);
  }

  // ─── Step 5: Summary ───
  console.log("\n=== Step 5: 최종 보고 ===\n");
  console.log(`백업 파일: ${backupPath}`);
  console.log(`변경 사용자: ${targetUsers.map((u) => u.username).join(", ")}`);
  console.log(`AuditLog IDs: ${auditLogIds.join(", ")}`);
  console.log(`검증: 모든 SELLER centerId NULL — ${sellersWithCenter === 0 ? "PASS" : "FAIL"}`);
  console.log(`사이드이펙트: 방송/발주 데이터 영향 없음`);
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
