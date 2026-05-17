/**
 * 2026-05-12 핫픽스 검증 — 권한 격리 + 비활성화 UI + 운영 흐름 안내
 *
 * 대표님 답변 반영 (Q1-B / Q2-A / Q3-A):
 * A. ONEWMS 위젯 권한 격리 (T01-T03)
 * B. 자동 등록 미검토 뱃지 (T04-T05)
 * C. 사용자 비활성화 UI (T06-T08)
 * D. 상품 관리 센터 권한 격리 (T09-T11)
 * E. 발주 엑셀 업로드 안내 (T12-T13)
 * F. 회귀 점검 (T14)
 *
 * 운영 도메인: https://www.supermujin.ai
 * 기본 storageState: supermujin.json (MASTER)
 * SUB_MASTER 테스트는 browser.newContext()로 별도 세션
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "https://www.supermujin.ai";
const MASTER_STATE = "playwright/.auth/supermujin.json";
const SUB_MASTER_STATE = "playwright/.auth/supermujin-submaster.json";

// 기본 auth: MASTER
test.use({ storageState: MASTER_STATE });

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
async function navigateViaSidebar(page: Page, menuText: string) {
  const sidebar = page.locator("aside");
  const link = sidebar.locator("a", { hasText: menuText });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

// ════════════════════════════════════════════════
// A. ONEWMS 위젯 권한 격리 (T01-T03)
// ════════════════════════════════════════════════
test.describe("A. ONEWMS 위젯 권한 격리", () => {
  test("T01: MASTER /dashboard → 'ONEWMS 연동 상태' 위젯 가시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });

    const widget = page.locator("text=ONEWMS 연동 상태");
    await expect(widget).toBeVisible({ timeout: 15000 });

    await expect(page.locator("text=실패 주문")).toBeVisible();
    await expect(page.locator("text=재고 충돌")).toBeVisible();
  });

  test("T02: SUB_MASTER /dashboard → 'ONEWMS 연동 상태' 위젯 미가시", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: SUB_MASTER_STATE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });

    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    const widget = page.locator("text=ONEWMS 연동 상태");
    await expect(widget).toHaveCount(0);

    await ctx.close();
  });

  test("T03: SUB_MASTER → /api/onewms/stats 호출 차단 확인", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: SUB_MASTER_STATE });
    const page = await ctx.newPage();

    const onewmsRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/onewms")) {
        onewmsRequests.push(req.url());
      }
    });

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);

    expect(onewmsRequests.length).toBe(0);
    await ctx.close();
  });
});

// ════════════════════════════════════════════════
// B. 자동 등록 미검토 뱃지 (T04-T05)
// ════════════════════════════════════════════════
test.describe("B. 자동 등록 미검토 뱃지 권한 격리", () => {
  test("T04: MASTER /products → '자동 등록' 뱃지 영역 가시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "상품 관리");

    const autoBadge = page.locator("button", { hasText: /자동 등록.*미검토/ });
    await expect(autoBadge).toBeVisible({ timeout: 10000 });
  });

  test("T05: SUB_MASTER /products → '자동 등록' 뱃지 미가시", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: SUB_MASTER_STATE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "상품 관리");

    await expect(page.locator("h1", { hasText: "상품 관리" })).toBeVisible({ timeout: 10000 });
    const autoBadge = page.locator("button", { hasText: /자동 등록.*미검토/ });
    await expect(autoBadge).toHaveCount(0);

    await ctx.close();
  });
});

// ════════════════════════════════════════════════
// C. 사용자 비활성화 UI (T06-T08)
// ════════════════════════════════════════════════
test.describe("C. 사용자 비활성화 UI", () => {
  const TS = Date.now().toString(36).slice(-5);
  let dummyUserId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: MASTER_STATE });
    const page = await ctx.newPage();
    const res = await page.request.post(`${BASE}/api/users`, {
      headers: { Origin: BASE, "Content-Type": "application/json" },
      data: {
        username: "e2e_deact_" + TS,
        password: "TestDeact1234",
        name: "비활성화테스트_" + TS,
        email: `e2e_deact_${TS}@test.com`,
        role: "SELLER",
      },
    });
    const json = await res.json();
    dummyUserId = json.data?.id || null;
    console.log("Created dummy user:", dummyUserId);
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!dummyUserId) return;
    const ctx = await browser.newContext({ storageState: MASTER_STATE });
    const page = await ctx.newPage();
    await page.request.delete(`${BASE}/api/users/${dummyUserId}`, {
      headers: { Origin: BASE },
    });
    console.log("Cleaned up dummy user:", dummyUserId);
    await ctx.close();
  });

  test("T06: MASTER /users 액션 컬럼에 '비활성화' 또는 '활성화' 버튼 가시", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    await expect(page.locator("th", { hasText: "액션" })).toBeVisible({ timeout: 10000 });
    const deactivateBtn = page.locator("button", { hasText: "비활성화" }).first();
    await expect(deactivateBtn).toBeVisible({ timeout: 5000 });
  });

  test("T07: '비활성화' 클릭 → 확인 다이얼로그 노출", async ({ page }) => {
    if (!dummyUserId) {
      test.skip(true, "더미 사용자 생성 실패");
      return;
    }

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    const dummyRow = page.locator("tr", { hasText: "비활성화테스트_" + TS });
    await expect(dummyRow).toBeVisible({ timeout: 10000 });

    let confirmMessage = "";
    page.on("dialog", async (dialog) => {
      confirmMessage = dialog.message();
      await dialog.dismiss();
    });

    const deactivateBtn = dummyRow.locator("button", { hasText: "비활성화" });
    await expect(deactivateBtn).toBeVisible();
    await deactivateBtn.click();
    await page.waitForTimeout(1000);

    expect(confirmMessage).toContain("비활성화");
  });

  test("T08: 확인 후 상태 변경 → toast + 행 상태 변경", async ({ page }) => {
    if (!dummyUserId) {
      test.skip(true, "더미 사용자 생성 실패");
      return;
    }

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "사용자 관리");

    const dummyRow = page.locator("tr", { hasText: "비활성화테스트_" + TS });
    await expect(dummyRow).toBeVisible({ timeout: 10000 });

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    const deactivateBtn = dummyRow.locator("button", { hasText: "비활성화" });
    await expect(deactivateBtn).toBeVisible();
    await deactivateBtn.click();

    // toast 또는 행 상태 변경 확인
    const successToast = page.locator("text=비활성화되었습니다");
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // 다시 활성화 (cleanup)
    await page.waitForTimeout(500);
    const activateBtn = dummyRow.locator("button", { hasText: "활성화" }).first();
    if (await activateBtn.isVisible()) {
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });
      await activateBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});

// ════════════════════════════════════════════════
// D. 상품 관리 센터 권한 격리 (T09-T11)
// ════════════════════════════════════════════════
test.describe("D. 상품 관리 센터 권한 격리", () => {
  test("T09: SUB_MASTER /products 첫 진입 → 기본 탭 '우리 센터 제품'", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: SUB_MASTER_STATE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "상품 관리");

    const centerBtn = page.locator("button", { hasText: "우리 센터 제품" });
    await expect(centerBtn).toBeVisible({ timeout: 10000 });

    await ctx.close();
  });

  test("T10: SUB_MASTER /products → '전체' 탭 안 보임", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: SUB_MASTER_STATE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "상품 관리");

    await expect(page.locator("h1", { hasText: "상품 관리" })).toBeVisible({ timeout: 10000 });
    const allBtn = page.locator("button", { hasText: /^전체$/ });
    await expect(allBtn).toHaveCount(0);

    await ctx.close();
  });

  test("T11: SUB_MASTER /products → '본사 카탈로그' 클릭 → '열람 전용' 안내 박스", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: SUB_MASTER_STATE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
    await navigateViaSidebar(page, "상품 관리");

    const hqBtn = page.locator("button", { hasText: "본사 카탈로그" });
    await expect(hqBtn).toBeVisible({ timeout: 10000 });
    await hqBtn.click();
    await page.waitForTimeout(1000);

    const notice = page.locator("text=열람만 가능하며");
    await expect(notice).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });
});

// ════════════════════════════════════════════════
// E. 발주 엑셀 업로드 안내 (T12-T13)
// ════════════════════════════════════════════════
test.describe("E. 발주 엑셀 업로드 안내", () => {
  test("T12: /orders/upload → 상단 노란 안내 박스 '발주 처리 흐름 안내' 가시", async ({ page }) => {
    await page.goto(`${BASE}/orders/upload`, { waitUntil: "networkidle", timeout: 15000 });

    const guideBox = page.locator("text=발주 처리 흐름 안내");
    await expect(guideBox).toBeVisible({ timeout: 10000 });
  });

  test("T13: 안내 박스에 'ONEWMS에 매칭되지 않습니다' 문구 가시", async ({ page }) => {
    await page.goto(`${BASE}/orders/upload`, { waitUntil: "networkidle", timeout: 15000 });

    const wmsTip = page.locator("text=ONEWMS에 매칭되지 않습니다");
    await expect(wmsTip).toBeVisible({ timeout: 10000 });
  });
});

// ════════════════════════════════════════════════
// F. 회귀 점검 (T14)
// ════════════════════════════════════════════════
test.describe("F. 회귀 점검", () => {
  test("T14: 기존 핵심 기능 — /centers + /proposals + /users 정상 동작", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 20000 });

    await navigateViaSidebar(page, "센터 관리");
    await expect(page.locator("h1", { hasText: "센터 관리" })).toBeVisible({ timeout: 10000 });

    await navigateViaSidebar(page, "상품 제안");
    await expect(page.locator("h1", { hasText: "상품 제안" })).toBeVisible({ timeout: 10000 });

    await navigateViaSidebar(page, "사용자 관리");
    await expect(page.locator("h1", { hasText: "사용자 관리" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button", { hasText: "비활성화" }).first()).toBeVisible({ timeout: 5000 });
  });
});
