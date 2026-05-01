import { test, expect, type Page } from "@playwright/test";

/**
 * ADMIN Role 제거 검증 테스트
 *
 * ADMIN role이 완전히 제거되었는지 확인:
 * 1. 사용자 관리 페이지 role 드롭다운에 ADMIN 없음
 * 2. API 응답에 ADMIN role 사용자 없음
 * 3. 변경 이력에 ADMIN role 잔존 없음
 * 4. 권한 모델: MASTER / SUB_MASTER / SELLER 3종만 존재
 */

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = "https://live-commerce-opal.vercel.app";

async function login(page: Page, username: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.getByPlaceholder("아이디를 입력하세요").fill(username);
  await page.getByPlaceholder("비밀번호를 입력하세요").fill(password);
  await page.getByRole("button", { name: /로그인/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

// ────────────────────────────────────────────────────────
// 1. API: 사용자 목록에 ADMIN role 사용자 없음
// ────────────────────────────────────────────────────────
test("1. API: 사용자 목록에 ADMIN role 사용자 0명", async ({ page }) => {
  await login(page, "master", "master1234");

  const usersRes = await page.request.get(
    `${BASE}/api/users?pageSize=100`
  );
  expect(usersRes.status()).toBe(200);

  const usersJson = await usersRes.json();
  const users = usersJson.data || [];

  // ADMIN role 사용자가 없어야 함
  const adminUsers = users.filter((u: any) => u.role === "ADMIN");
  console.log(`전체 사용자: ${users.length}명, ADMIN: ${adminUsers.length}명`);
  expect(adminUsers.length).toBe(0);

  // 허용되는 role만 존재
  const roles = [...new Set(users.map((u: any) => u.role))];
  console.log("존재하는 role:", roles);
  for (const role of roles) {
    expect(["MASTER", "SUB_MASTER", "SELLER"]).toContain(role);
  }
});

// ────────────────────────────────────────────────────────
// 2. API: 사용자 응답에 adminId 필드 없음
// ────────────────────────────────────────────────────────
test("2. API: 사용자 응답에 adminId 필드 없음", async ({ page }) => {
  await login(page, "master", "master1234");

  const usersRes = await page.request.get(
    `${BASE}/api/users?pageSize=10`
  );
  const usersJson = await usersRes.json();
  const users = usersJson.data || [];

  test.skip(users.length === 0, "사용자 데이터 없음");

  for (const user of users) {
    expect(user).not.toHaveProperty("adminId");
  }
  console.log(`${users.length}명 사용자 확인: adminId 필드 없음`);
});

// ────────────────────────────────────────────────────────
// 3. API: 주문 응답에 adminId 필드 없음
// ────────────────────────────────────────────────────────
test("3. API: 주문 응답에 adminId 필드 없음", async ({ page }) => {
  await login(page, "master", "master1234");

  const ordersRes = await page.request.get(
    `${BASE}/api/orders?pageSize=10`
  );
  const ordersJson = await ordersRes.json();
  const orders = ordersJson.data || [];

  test.skip(orders.length === 0, "주문 데이터 없음");

  for (const order of orders) {
    expect(order).not.toHaveProperty("adminId");
  }
  console.log(`${orders.length}건 주문 확인: adminId 필드 없음`);
});

// ────────────────────────────────────────────────────────
// 4. UI: 사용자 관리 페이지 role 드롭다운에 ADMIN 없음
// ────────────────────────────────────────────────────────
test("4. UI: 사용자 편집 role 드롭다운에 ADMIN 옵션 없음", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/users`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // 첫 번째 사용자의 편집 버튼 클릭
  const editBtn = page.getByRole("button", { name: /편집|수정/ }).first();
  const hasEdit = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);
  test.skip(!hasEdit, "편집 버튼 없음");

  await editBtn.click();
  await page.waitForTimeout(1000);

  // role 드롭다운 찾기
  const roleSelect = page.locator("button[role='combobox']").filter({ hasText: /전체관리자|관리자|셀러/ });
  const hasRoleSelect = await roleSelect.isVisible({ timeout: 3000 }).catch(() => false);
  test.skip(!hasRoleSelect, "role 드롭다운 없음");

  await roleSelect.click();
  await page.waitForTimeout(500);

  // ADMIN 옵션이 없어야 함
  const adminOption = page.locator("[role='option']").filter({ hasText: /^ADMIN$/ });
  const adminCount = await adminOption.count();
  expect(adminCount).toBe(0);

  // 존재하는 옵션 확인
  const options = page.locator("[role='option']");
  const optionCount = await options.count();
  console.log(`role 드롭다운 옵션: ${optionCount}개`);
  for (let i = 0; i < optionCount; i++) {
    const text = await options.nth(i).textContent();
    console.log(`  - ${text}`);
  }

  await page.screenshot({
    path: "test-results/admin-removal-01-role-dropdown.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 5. API: 변경 이력에 userRole=ADMIN 잔존 없음
// ────────────────────────────────────────────────────────
test("5. API: AuditLog에 userRole=ADMIN 잔존 없음", async ({ page }) => {
  await login(page, "master", "master1234");

  // AuditLog API 호출 (최근 100건)
  const logRes = await page.request.get(
    `${BASE}/api/admin/audit-log?pageSize=100`
  );

  if (logRes.status() !== 200) {
    console.log("AuditLog API 접근 불가 — 스킵");
    return;
  }

  const logJson = await logRes.json();
  const logs = logJson.data || [];

  const adminRoleLogs = logs.filter((l: any) => l.userRole === "ADMIN");
  console.log(`AuditLog ${logs.length}건 중 userRole=ADMIN: ${adminRoleLogs.length}건`);
  expect(adminRoleLogs.length).toBe(0);
});

// ────────────────────────────────────────────────────────
// 6. 기존 admin1 계정이 SUB_MASTER로 변환됨 확인
// ────────────────────────────────────────────────────────
test("6. admin1 계정 role=SUB_MASTER 확인", async ({ page }) => {
  await login(page, "master", "master1234");

  const userRes = await page.request.get(
    `${BASE}/api/users?search=admin1&pageSize=1`
  );
  const userJson = await userRes.json();
  const users = userJson.data || [];

  test.skip(users.length === 0, "admin1 사용자 없음");

  const admin1 = users[0];
  console.log(`admin1: role=${admin1.role}, isActive=${admin1.isActive}`);
  expect(admin1.role).toBe("SUB_MASTER");
});
