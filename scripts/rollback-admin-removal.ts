/**
 * 롤백 스크립트: ADMIN role 제거 마이그레이션 실패 시 데이터 복원
 *
 * 사용법:
 *   npx tsx scripts/rollback-admin-removal.ts <backup-dir>
 *
 * 예시:
 *   npx tsx scripts/rollback-admin-removal.ts backups/pre-admin-removal-2026-05-01T01-31-05-568Z
 *
 * ⚠️ 주의:
 * - Prisma schema에 adminId 컬럼과 ADMIN enum 값이 존재해야 복원 가능
 * - schema도 롤백이 필요한 경우:
 *   1. git stash 또는 git checkout -- prisma/schema.prisma
 *   2. npx prisma migrate dev (또는 db push)
 *   3. 이 스크립트 실행
 * - 실행 전 반드시 현재 상태를 확인하고, 형님 승인 후 진행
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import fs from "fs/promises";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

interface BackupUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  centerId: string | null;
  adminId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackupOrder {
  id: string;
  orderNo: string;
  adminId: string;
  sellerId: string;
}

async function rollback() {
  const backupDir = process.argv[2];
  if (!backupDir) {
    console.error("Usage: npx tsx scripts/rollback-admin-removal.ts <backup-dir>");
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), backupDir);

  // 백업 파일 읽기
  const usersRaw = await fs.readFile(path.join(fullPath, "users.json"), "utf-8");
  const ordersRaw = await fs.readFile(path.join(fullPath, "orders-with-admin.json"), "utf-8");

  const users: BackupUser[] = JSON.parse(usersRaw);
  const orders: BackupOrder[] = JSON.parse(ordersRaw);

  console.log(`📦 Backup loaded from: ${fullPath}`);
  console.log(`- Users to restore: ${users.length}`);
  console.log(`- Orders to restore adminId: ${orders.length}`);

  // DRY RUN: 먼저 무엇이 변경될지 보여줌
  console.log("\n--- DRY RUN ---");

  const adminUsers = users.filter((u) => u.role === "ADMIN");
  console.log(`\nADMIN role 복원 대상: ${adminUsers.length}명`);
  adminUsers.forEach((u) => console.log(`  - ${u.username} (${u.name})`));

  const usersWithAdminId = users.filter((u) => u.adminId !== null);
  console.log(`\nadminId 복원 대상: ${usersWithAdminId.length}명`);
  usersWithAdminId.forEach((u) => console.log(`  - ${u.username}: adminId=${u.adminId}`));

  console.log(`\nOrder adminId 복원 대상: ${orders.length}건`);
  orders.forEach((o) => console.log(`  - ${o.orderNo}: adminId=${o.adminId}`));

  // 확인 프롬프트
  console.log("\n⚠️  위 변경사항을 적용하려면 --confirm 플래그를 추가하세요:");
  console.log(`   npx tsx scripts/rollback-admin-removal.ts ${backupDir} --confirm`);

  if (!process.argv.includes("--confirm")) {
    console.log("\n(DRY RUN 완료 - 실제 변경 없음)");
    return;
  }

  // 실제 복원
  console.log("\n🔄 Restoring...");

  // 1. User role + adminId 복원
  for (const user of users) {
    try {
      await (prisma.user as any).update({
        where: { id: user.id },
        data: {
          role: user.role,
          adminId: user.adminId,
          isActive: user.isActive,
        },
      });
      console.log(`  ✅ User ${user.username}: role=${user.role}, adminId=${user.adminId}`);
    } catch (err: any) {
      console.error(`  ❌ User ${user.username}: ${err.message}`);
    }
  }

  // 2. Order adminId 복원
  for (const order of orders) {
    try {
      await (prisma.order as any).update({
        where: { id: order.id },
        data: { adminId: order.adminId },
      });
      console.log(`  ✅ Order ${order.orderNo}: adminId=${order.adminId}`);
    } catch (err: any) {
      console.error(`  ❌ Order ${order.orderNo}: ${err.message}`);
    }
  }

  console.log("\n✅ Rollback completed!");
}

rollback()
  .catch((e) => {
    console.error("❌ Rollback failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
