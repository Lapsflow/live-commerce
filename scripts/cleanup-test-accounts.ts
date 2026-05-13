/**
 * 테스트 계정 + 센터 일괄 정리 스크립트
 *
 * 사용 예:
 *   pnpm tsx scripts/cleanup-test-accounts.ts            # dry-run (삭제하지 않고 목록만 표시)
 *   pnpm tsx scripts/cleanup-test-accounts.ts --apply    # 실제 삭제 실행
 *
 * 보호 계정 (절대 삭제 안 함):
 *   - master (실제 운영 마스터)
 *   - admin1 (실제 운영 관리자)
 *   - seller1, seller2, seller3 (운영 셀러)
 *
 * 삭제 대상 (이름 또는 username 패턴):
 *   - "테스트", "test", "E2E", "Validation", "Acceptance" 등 패턴
 *   - 센터명에 "테스트", "test", "E2E" 패턴
 */

import { prisma } from "../lib/db/prisma";

const PROTECTED_USERNAMES = ["master", "admin1", "seller1", "seller2", "seller3"];

// 삭제 대상 식별 패턴 (대소문자 무시, 일부만 매칭되어도 OK)
const TEST_PATTERNS = [
  /test/i,
  /e2e/i,
  /validation/i,
  /acceptance/i,
  /수락테스트/,
  /통합테스트/,
  /변경테스터/,
  /해시테스트/,
  /로그인테스트/,
  /MCP테스트/i,
  /Bcrypt테스트/i,
  /Phase\d/,
  /테스터/,
  /^센터테스트$/,
  /^센터관리자$/, // 이름이 그냥 "센터관리자"인 계정 (보통 테스트)
];

function isTestAccount(name: string, username: string | null): boolean {
  const targets = [name, username || ""];
  return TEST_PATTERNS.some((p) => targets.some((t) => p.test(t)));
}

function isTestCenter(name: string, code: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(name) || p.test(code));
}

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=".repeat(60));
  console.log(apply ? "🔥 APPLY MODE — 실제 삭제 진행" : "🔍 DRY-RUN — 삭제하지 않고 목록만 표시");
  console.log("=".repeat(60));

  // 1. 사용자 조회
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      email: true,
      phone: true,
      centerId: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const userTargets = users.filter((u) => {
    if (u.username && PROTECTED_USERNAMES.includes(u.username)) return false;
    return isTestAccount(u.name, u.username);
  });

  console.log(`\n📋 사용자: 전체 ${users.length}명, 삭제 대상 ${userTargets.length}명`);
  console.log("-".repeat(60));
  for (const u of userTargets) {
    console.log(
      `  - [${u.role}] ${u.name} (${u.username ?? "-"}) | center: ${u.centerId ?? "-"} | ${u.createdAt.toISOString().slice(0, 10)}`
    );
  }

  // 2. 센터 조회
  const centers = await prisma.center.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      regionName: true,
      representative: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const centerTargets = centers.filter((c) => isTestCenter(c.name, c.code));

  console.log(`\n📦 센터: 전체 ${centers.length}개, 삭제 대상 ${centerTargets.length}개`);
  console.log("-".repeat(60));
  for (const c of centerTargets) {
    console.log(`  - ${c.code} | ${c.name} | ${c.regionName} | ${c.createdAt.toISOString().slice(0, 10)}`);
  }

  if (!apply) {
    console.log("\n✋ DRY-RUN 종료. 실제 삭제하려면 --apply 옵션을 추가하세요.");
    console.log("   pnpm tsx scripts/cleanup-test-accounts.ts --apply");
    return;
  }

  // 3. 실제 삭제 — 사용자
  console.log("\n🗑  사용자 삭제 진행...");
  let userDeleted = 0;
  for (const u of userTargets) {
    try {
      await prisma.user.delete({ where: { id: u.id } });
      userDeleted += 1;
    } catch (err: any) {
      console.error(`  ❌ ${u.name} (${u.username}) 삭제 실패: ${err.message}`);
    }
  }
  console.log(`✅ 사용자 ${userDeleted}/${userTargets.length}명 삭제 완료`);

  // 4. 실제 삭제 — 센터
  console.log("\n🗑  센터 삭제 진행...");
  let centerDeleted = 0;
  for (const c of centerTargets) {
    try {
      await prisma.center.delete({ where: { id: c.id } });
      centerDeleted += 1;
    } catch (err: any) {
      console.error(`  ❌ ${c.code} ${c.name} 삭제 실패: ${err.message}`);
      console.error(`     (소속 사용자가 있거나 발주/방송 이력이 있을 수 있음)`);
    }
  }
  console.log(`✅ 센터 ${centerDeleted}/${centerTargets.length}개 삭제 완료`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 정리 완료");
  console.log("=".repeat(60));
}

main()
  .catch((err) => {
    console.error("스크립트 실행 중 오류:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
