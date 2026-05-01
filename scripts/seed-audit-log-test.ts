/**
 * Seed AuditLog test data
 *
 * Creates 50 fake AuditLog entries for development/testing.
 * Uses existing users if available, otherwise creates with anonymous data.
 * Uses DIRECT_URL (non-pooled) to avoid Neon adapter issues in scripts.
 *
 * Usage: npx tsx scripts/seed-audit-log-test.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { PrismaClient, AuditAction, Prisma, Role } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Use DIRECT_URL for script execution (bypasses Neon pooler)
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon({ connectionString } as any);
const prisma = new PrismaClient({ adapter } as unknown as ConstructorParameters<typeof PrismaClient>[0]);

const ENTITY_TYPES = ["USER", "PRODUCT", "ORDER", "BROADCAST", "CENTER"];

const ACTIONS_BY_ENTITY: Record<string, AuditAction[]> = {
  USER: ["CREATE", "UPDATE", "ROLE_CHANGED", "DELETE", "LOGIN", "LOGIN_FAILED"],
  PRODUCT: ["CREATE", "UPDATE", "IMPORT", "DELETE"],
  ORDER: ["CREATE", "UPDATE", "STATUS_CHANGED", "IMPORT"],
  BROADCAST: ["CREATE", "STATUS_CHANGED", "UPDATE"],
  CENTER: ["CREATE", "UPDATE", "SOFT_DELETE"],
};

const DESCRIPTIONS: Record<string, string[]> = {
  CREATE: ["새로 생성됨", "시스템에 등록됨", "신규 항목 추가"],
  UPDATE: ["정보 수정됨", "필드 변경됨", "데이터 업데이트"],
  DELETE: ["삭제됨", "시스템에서 제거됨"],
  SOFT_DELETE: ["비활성화됨", "소프트 삭제 처리"],
  ROLE_CHANGED: ["역할이 SELLER에서 SUB_MASTER로 변경", "역할이 SUB_MASTER에서 SELLER로 변경"],
  STATUS_CHANGED: ["상태가 PENDING에서 CONFIRMED로 변경", "상태가 SCHEDULED에서 LIVE로 변경", "상태가 LIVE에서 ENDED로 변경"],
  LOGIN: ["로그인 성공"],
  LOGIN_FAILED: ["잘못된 비밀번호로 로그인 실패", "존재하지 않는 사용자 로그인 시도"],
  IMPORT: ["외부 시스템에서 가져오기", "CSV 파일 일괄 등록"],
};

const SAMPLE_DIFFS: Record<string, Record<string, { from: unknown; to: unknown }>> = {
  UPDATE: {
    name: { from: "이전 이름", to: "변경된 이름" },
    phone: { from: "010-1234-5678", to: "010-9876-5432" },
  },
  ROLE_CHANGED: {
    role: { from: "SELLER", to: "SUB_MASTER" },
  },
  STATUS_CHANGED: {
    status: { from: "PENDING", to: "CONFIRMED" },
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  const offset = Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
}

async function main() {
  console.log("🌱 Seeding 50 AuditLog entries...\n");

  // Find existing users to reference
  const users = await prisma.user.findMany({
    take: 10,
    select: { id: true, name: true, role: true },
  });

  if (users.length === 0) {
    console.log("⚠️  No users found. AuditLog entries will have null userId.");
  } else {
    console.log(`📋 Found ${users.length} users to reference.`);
  }

  const logs = [];

  for (let i = 0; i < 50; i++) {
    const entityType = pick(ENTITY_TYPES);
    const action = pick(ACTIONS_BY_ENTITY[entityType]);
    const user = users.length > 0 ? pick(users) : null;
    const descList = DESCRIPTIONS[action] || ["작업 수행됨"];
    const diff = SAMPLE_DIFFS[action] || null;

    logs.push({
      userId: user?.id || null,
      userName: user?.name || "시스템",
      userRole: (user?.role as Role) || null,
      action,
      entityType,
      entityId: `fake-${entityType.toLowerCase()}-${randomId()}`,
      entityName: `테스트 ${entityType} #${i + 1}`,
      before: action === "CREATE" ? Prisma.JsonNull : ({ name: "이전값", status: "PENDING" } as Prisma.InputJsonValue),
      after: action === "DELETE" ? Prisma.JsonNull : ({ name: "변경값", status: "CONFIRMED" } as Prisma.InputJsonValue),
      diff: diff ? (diff as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: "seed-script/1.0",
      description: pick(descList),
      createdAt: randomDate(30),
    });
  }

  const result = await prisma.auditLog.createMany({ data: logs });
  console.log(`\n✅ Created ${result.count} AuditLog entries.`);

  // Summary
  const counts = await prisma.auditLog.groupBy({
    by: ["action"],
    _count: true,
  });
  console.log("\n📊 Action 별 분포:");
  for (const c of counts) {
    console.log(`   ${c.action}: ${c._count}건`);
  }

  console.log("\n🎉 Seed 완료!");
}

main()
  .catch((e) => {
    console.error("❌ Seed 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
