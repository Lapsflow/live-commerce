/**
 * C-7: 직원 테스트 계정 생성 스크립트
 *
 * 생성 계정:
 * - test_subm_a (SUB_MASTER, 센터 A 배정)
 * - test_subm_b (SUB_MASTER, 센터 B 배정)
 * - test_seller_a (SELLER)
 * - test_seller_b (SELLER)
 * - test_seller_c (SELLER)
 *
 * 사용법: npx tsx scripts/create-test-employees.ts
 * 비활성화: npx tsx scripts/create-test-employees.ts --deactivate
 * 삭제:    npx tsx scripts/create-test-employees.ts --delete
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const adapter = new PrismaNeon({ connectionString: DATABASE_URL } as any);
const prisma = new PrismaClient({
  adapter,
} as unknown as ConstructorParameters<typeof PrismaClient>[0]);

// ── 테스트 계정 정의 ──
const TEST_PREFIX = "test_";
const TEST_PASSWORD = "Test!2026";

interface TestAccount {
  username: string;
  name: string;
  email: string;
  phone: string;
  role: "SUB_MASTER" | "SELLER";
  centerIndex?: number; // 0-based index of center to assign
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    username: "test_subm_a",
    name: "테스트 관리자 A",
    email: "test_subm_a@supermujin.ai",
    phone: "010-0000-0001",
    role: "SUB_MASTER",
    centerIndex: 0,
  },
  {
    username: "test_subm_b",
    name: "테스트 관리자 B",
    email: "test_subm_b@supermujin.ai",
    phone: "010-0000-0002",
    role: "SUB_MASTER",
    centerIndex: 1,
  },
  {
    username: "test_seller_a",
    name: "테스트 셀러 A",
    email: "test_seller_a@supermujin.ai",
    phone: "010-0000-0003",
    role: "SELLER",
  },
  {
    username: "test_seller_b",
    name: "테스트 셀러 B",
    email: "test_seller_b@supermujin.ai",
    phone: "010-0000-0004",
    role: "SELLER",
  },
  {
    username: "test_seller_c",
    name: "테스트 셀러 C",
    email: "test_seller_c@supermujin.ai",
    phone: "010-0000-0005",
    role: "SELLER",
  },
];

async function createAccounts() {
  console.log("=== 직원 테스트 계정 생성 ===\n");

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // 센터 목록 조회 (SUB_MASTER 센터 배정용)
  const centers = await prisma.center.findMany({
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  console.log(`센터 ${centers.length}개 조회됨`);

  for (const account of TEST_ACCOUNTS) {
    const centerId =
      account.centerIndex !== undefined && centers[account.centerIndex]
        ? centers[account.centerIndex].id
        : null;

    try {
      const user = await prisma.user.upsert({
        where: { username: account.username },
        update: {
          passwordHash,
          isActive: true,
          role: account.role,
          centerId,
          contractStatus: "APPROVED",
        },
        create: {
          username: account.username,
          name: account.name,
          email: account.email,
          phone: account.phone,
          role: account.role,
          passwordHash,
          isActive: true,
          centerId,
          contractStatus: "APPROVED",
        },
      });

      const centerName = centerId
        ? centers.find((c) => c.id === centerId)?.name || "?"
        : "-";

      console.log(
        `  ✅ ${account.username} | ${account.role} | ${account.name} | 센터: ${centerName}`
      );
    } catch (e: any) {
      console.error(`  ❌ ${account.username}: ${e.message}`);
    }
  }

  console.log(`\n비밀번호: ${TEST_PASSWORD}`);
  console.log("모든 계정 contractStatus: APPROVED");
  console.log("\n테스트 종료 후: npx tsx scripts/create-test-employees.ts --deactivate");
}

async function deactivateAccounts() {
  console.log("=== 테스트 계정 비활성화 ===\n");

  for (const account of TEST_ACCOUNTS) {
    try {
      await prisma.user.update({
        where: { username: account.username },
        data: { isActive: false },
      });
      console.log(`  ⬜ ${account.username} → 비활성화`);
    } catch (e: any) {
      console.log(`  ⏭️ ${account.username}: 존재하지 않음`);
    }
  }

  console.log("\n비활성화 완료. 로그인 불가 상태.");
}

async function deleteAccounts() {
  console.log("=== 테스트 계정 삭제 ===\n");

  for (const account of TEST_ACCOUNTS) {
    try {
      await prisma.user.delete({
        where: { username: account.username },
      });
      console.log(`  🗑️ ${account.username} → 삭제됨`);
    } catch (e: any) {
      console.log(`  ⏭️ ${account.username}: ${e.message.includes("not found") ? "존재하지 않음" : e.message}`);
    }
  }

  console.log("\n삭제 완료.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--deactivate")) {
    await deactivateAccounts();
  } else if (args.includes("--delete")) {
    await deleteAccounts();
  } else {
    await createAccounts();
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
