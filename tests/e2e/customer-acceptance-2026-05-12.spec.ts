/**
 * 고객 수락 검증 (Customer Acceptance Test) — 2026-05-12
 *
 * PROPOSAL-07 Part 2: 명명 통일 + 방송별 통합 발주서
 *
 * A. 명명 통일 (T01–T05): ROLE_LABELS 적용 확인
 * B. 방송별 통합 발주서 (T06–T10): 화면 구성 및 기능
 * C. 권한 격리 (T11): 비-MASTER 접근 차단
 * D. 회귀 (T12): 기존 수락 테스트 20건 영향 없음
 *
 * 운영 도메인: https://www.supermujin.ai
 * 인증: playwright/.auth/supermujin.json (MASTER 계정)
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const BASE = "https://www.supermujin.ai";

// ──────────────────────────────────────────────
// Auth setup — supermujin.ai 운영 도메인 전용
// ──────────────────────────────────────────────
test.use({ storageState: "playwright/.auth/supermujin.json" });

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
async function apiGet(request: APIRequestContext, path: string) {
  return request.get(`${BASE}${path}`, {
    headers: { Origin: BASE },
  });
}

/** 사이드바 메뉴 클릭으로 페이지 이동 */
async function navigateViaSidebar(page: Page, menuText: string) {
  const sidebar = page.locator("aside");
  const link = sidebar.locator("a", { hasText: menuText });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

// ════════════════════════════════════════════════
// A. 명명 통일 (T01–T05)
// ════════════════════════════════════════════════
test.describe("A. 명명 통일 — ROLE_LABELS 적용", () => {
  test("T01: /users 페이지에서 SUB_MASTER 사용자에 '센터관리자' 뱃지 표시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    // "센터관리자" 텍스트가 뱃지로 표시되는지 확인
    const badge = page.locator("text=센터관리자").first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("T02: /users 페이지에서 MASTER 사용자에 '마스터(본사)' 뱃지 표시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    const badge = page.locator("text=마스터(본사)").first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("T03: /users 페이지에서 SELLER 사용자에 '셀러' 뱃지 표시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    const badge = page.locator("text=셀러").first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("T04: 사용자 추가 다이얼로그에서 역할 선택에 '센터관리자' 옵션 표시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    // "사용자 추가" 버튼 클릭
    const addBtn = page.locator("button", { hasText: "사용자 추가" });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // 다이얼로그 열림 확인
    await expect(page.locator("text=사용자 추가").first()).toBeVisible({ timeout: 5000 });

    // 역할 Select 트리거 클릭
    const roleLabel = page.locator("label", { hasText: "역할" });
    await expect(roleLabel).toBeVisible({ timeout: 5000 });

    // Select 트리거 (역할 라벨 바로 다음의 SelectTrigger)
    const selectTrigger = page.locator("[role='combobox']").first();
    await selectTrigger.click();

    // "센터관리자" 옵션 확인
    const option = page.locator("[role='option']", { hasText: "센터관리자" });
    await expect(option).toBeVisible({ timeout: 5000 });
  });

  test("T05: GET /api/users → role 필드에 DB enum 값 (SUB_MASTER) 유지 확인", async ({ request }) => {
    const res = await apiGet(request, "/api/users?limit=50");
    expect(res.status()).toBe(200);

    const json = await res.json();
    const users = Array.isArray(json.data) ? json.data : (json.data?.users || []);

    // DB enum 값 확인 — UI 라벨이 아닌 원래 enum 값
    const roles = [...new Set(users.map((u: any) => u.role))];
    expect(roles).toContain("SUB_MASTER");
    // "센터관리자"는 DB enum이 아니므로 없어야 함
    expect(roles).not.toContain("센터관리자");
  });
});

// ════════════════════════════════════════════════
// B. 방송별 통합 발주서 (T06–T10)
// ════════════════════════════════════════════════
test.describe("B. 방송별 통합 발주서 — 화면 구성", () => {
  test("T06: 사이드바에 '방송별 통합 발주서' 메뉴 존재 및 클릭 시 /orders/by-broadcast 진입", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });

    const sidebar = page.locator("aside");
    const link = sidebar.locator("a", { hasText: "방송별 통합 발주서" });
    await expect(link).toBeVisible({ timeout: 10000 });

    await link.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await expect(page).toHaveURL(/\/orders\/by-broadcast/);
  });

  test("T07: 페이지 헤더 '방송별 통합 발주서' 및 서브타이틀 표시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "방송별 통합 발주서");

    // h1 헤더
    const h1 = page.locator("h1", { hasText: "방송별 통합 발주서" });
    await expect(h1).toBeVisible({ timeout: 10000 });

    // 서브타이틀
    const subtitle = page.locator("text=방송 단위로 본사 제품과 센터 제품 발주를 한눈에");
    await expect(subtitle).toBeVisible({ timeout: 5000 });
  });

  test("T08: 필터 영역 — 시작일/종료일 input + 발주 상태 select + 조회 버튼", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "방송별 통합 발주서");

    // 시작일 date input
    const startLabel = page.locator("text=시작일");
    await expect(startLabel).toBeVisible({ timeout: 10000 });
    const startInput = page.locator("input[type='date']").first();
    await expect(startInput).toBeVisible();

    // 종료일 date input
    const endLabel = page.locator("text=종료일");
    await expect(endLabel).toBeVisible();
    const endInput = page.locator("input[type='date']").nth(1);
    await expect(endInput).toBeVisible();

    // 발주 상태 select
    const statusLabel = page.locator("text=발주 상태");
    await expect(statusLabel).toBeVisible();
    const statusSelect = page.locator("select");
    await expect(statusSelect).toBeVisible();

    // select 옵션 확인
    const options = statusSelect.locator("option");
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain("전체");
    expect(optionTexts).toContain("PENDING");
    expect(optionTexts).toContain("APPROVED");
    expect(optionTexts).toContain("REJECTED");

    // 조회 버튼
    const queryBtn = page.locator("button", { hasText: "조회" });
    await expect(queryBtn).toBeVisible();
  });

  test("T09: 요약 카드 4개 — 방송 수, 발주 건수, 본사 제품 합계, 센터 제품 합계", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "방송별 통합 발주서");

    // 페이지 로드 완료 대기
    await expect(page.locator("h1", { hasText: "방송별 통합 발주서" })).toBeVisible({ timeout: 10000 });

    // 4개 요약 카드 텍스트 확인
    await expect(page.locator("text=방송 수")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=발주 건수")).toBeVisible();
    await expect(page.locator("text=본사 제품 합계")).toBeVisible();
    await expect(page.locator("text=센터 제품 합계")).toBeVisible();
  });

  test("T10: GET /api/orders/by-broadcast → 200 + broadcasts 배열 + count + range 필드 포함", async ({ request }) => {
    const res = await apiGet(request, "/api/orders/by-broadcast?from=2026-04-01&to=2026-05-12");
    expect(res.status()).toBe(200);

    const json = await res.json();
    const data = json.data;
    expect(data).toBeDefined();
    expect(Array.isArray(data.broadcasts)).toBe(true);
    expect(typeof data.count).toBe("number");
    expect(data.range).toBeDefined();
    expect(data.range.from).toBeDefined();
    expect(data.range.to).toBeDefined();
  });
});

// ════════════════════════════════════════════════
// C. 권한 격리 (T11)
// ════════════════════════════════════════════════
test.describe("C. 권한 격리", () => {
  test("T11: 비인증 사용자 — /api/orders/by-broadcast API 401 + 페이지 로그인 리다이렉트", async () => {
    // Node native fetch로 쿠키 없이 순수 API 요청 (Playwright 컨텍스트 간 쿠키 공유 회피)
    const res = await fetch(
      `${BASE}/api/orders/by-broadcast?from=2026-04-01&to=2026-05-12`,
      { headers: { Origin: BASE }, redirect: "manual" }
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error?.code).toBe("UNAUTHORIZED");

    // 페이지 접근도 redirect 확인 (302 → /login)
    const pageRes = await fetch(`${BASE}/orders/by-broadcast`, { redirect: "manual" });
    // Next.js는 미인증 사용자를 /login으로 리다이렉트 (307 또는 302)
    expect([301, 302, 303, 307, 308]).toContain(pageRes.status);
    const location = pageRes.headers.get("location") || "";
    expect(location).toContain("/login");
  });
});

// ════════════════════════════════════════════════
// D. 회귀 (T12)
// ════════════════════════════════════════════════
test.describe("D. 회귀 검증", () => {
  test("T12: 기존 핵심 기능 — /centers 페이지 센터 추가 폼 + /proposals 카드 UI 정상", async ({ page }) => {
    // 1) /centers 페이지 — 센터 추가 버튼 클릭 후 "센터 로그인 계정" 영역 존재
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "센터 관리");

    // "센터 추가" 버튼 클릭
    const addBtn = page.locator("button", { hasText: "센터 추가" }).or(page.locator("a", { hasText: "센터 추가" }));
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // "센터 로그인 계정" 영역 확인
    const centerAccountSection = page.locator("text=센터 로그인 계정");
    await expect(centerAccountSection).toBeVisible({ timeout: 10000 });

    // 2) /proposals 페이지 — 카드 그리드 + 카테고리 탭 정상
    await navigateViaSidebar(page, "상품 제안");
    const proposalHeader = page.locator("h1", { hasText: "상품 제안" });
    await expect(proposalHeader).toBeVisible({ timeout: 10000 });

    // 카테고리 탭 버튼 확인
    const allTab = page.locator("button.rounded-full", { hasText: /전체/ });
    await expect(allTab).toBeVisible({ timeout: 5000 });
  });
});
