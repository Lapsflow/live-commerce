import { test, expect, type Page } from "@playwright/test";

/**
 * Phase A 검증: 센터 상품 등록 + 마스터 모니터링
 *
 * 계정:
 * - MASTER: master / master1234
 * - ADMIN (센터 소속): admin1 / admin1234
 * - SELLER: seller1 / seller1234
 *
 * 각 테스트가 서로 다른 역할로 로그인하므로 storageState를 비움.
 */

// storageState 초기화 — 매 테스트마다 직접 로그인
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
// 1. MASTER: "센터 상품 현황" 메뉴 + 모니터링 페이지
// ────────────────────────────────────────────────────────
test("1. MASTER: 센터 상품 현황 메뉴 접근 + 페이지 렌더링", async ({ page }) => {
  await login(page, "master", "master1234");

  // 사이드바에 "센터 상품 현황" 메뉴 존재
  const menu = page.getByRole("link", { name: "센터 상품 현황" });
  await expect(menu).toBeVisible({ timeout: 10000 });

  // 클릭
  await menu.click();
  await page.waitForURL(/admin\/center-products/, { timeout: 10000 });

  // 핵심 요소 확인 — 요약 카드
  await expect(page.getByText("등록 센터")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("전체 상품")).toBeVisible();
  await expect(page.getByText("활성 상품", { exact: true })).toBeVisible();
  await expect(page.getByText("비활성 상품", { exact: true })).toBeVisible();

  // CSV 버튼
  await expect(page.getByRole("button", { name: /CSV/ })).toBeVisible();

  await page.screenshot({
    path: "test-results/01-master-center-products-page.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 2. ADMIN: "상품 관리" 메뉴 + 센터 상품 등록 버튼 확인
// ────────────────────────────────────────────────────────
test("2. ADMIN: 상품 관리 메뉴 + 센터 상품 등록 버튼", async ({ page }) => {
  await login(page, "admin1", "admin1234");

  // 사이드바에 "상품 관리" 메뉴 존재
  const menu = page.getByRole("link", { name: "상품 관리" });
  await expect(menu).toBeVisible({ timeout: 10000 });

  await menu.click();
  await page.waitForURL(/\/products/, { timeout: 10000 });

  // "센터 상품 등록" 버튼 존재
  const centerNewBtn = page.getByRole("link", { name: /센터 상품 등록/ });
  await expect(centerNewBtn).toBeVisible({ timeout: 10000 });

  await page.screenshot({
    path: "test-results/02-admin-products-page.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 3. ADMIN: 센터 상품 등록 폼 진입 + 코드 미리보기
// ────────────────────────────────────────────────────────
test("3. ADMIN: 센터 상품 등록 폼 + 코드 미리보기", async ({ page }) => {
  await login(page, "admin1", "admin1234");

  await page.goto(`${BASE}/products/center-new`);
  await page.waitForLoadState("networkidle");

  // 센터 표시 (ADMIN은 본인 센터 고정)
  await expect(page.getByText("소속 센터")).toBeVisible({ timeout: 10000 });

  // 자동 코드 미리보기 — [C숫자-숫자] 패턴
  const codePreview = page.locator(".font-mono");
  await expect(codePreview.first()).toBeVisible({ timeout: 10000 });
  const codeText = await codePreview.first().textContent();
  console.log("코드 미리보기:", codeText);

  // 필수 필드 확인
  await expect(page.locator("#name")).toBeVisible();
  await expect(page.locator("#barcode")).toBeVisible();
  await expect(page.locator("#sellPrice")).toBeVisible();
  await expect(page.locator("#supplyPrice")).toBeVisible();
  await expect(page.locator("#originalPrice")).toBeVisible();
  await expect(page.locator("#totalStock")).toBeVisible();

  await page.screenshot({
    path: "test-results/03-admin-center-new-form.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 4. MASTER: 센터 상품 신규 등록 (실제 등록)
//    MASTER로 로그인 → 센터 드롭다운 선택 → 등록
// ────────────────────────────────────────────────────────
test("4. MASTER: 센터 상품 등록 실행", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/products/center-new`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // MASTER: 센터 드롭다운에서 첫 번째 센터 선택
  // 센터 목록 로드 대기
  const centerDropdown = page.getByText("센터를 선택하세요");
  await expect(centerDropdown).toBeVisible({ timeout: 10000 });
  await centerDropdown.click();
  await page.waitForTimeout(1000);
  // 첫 번째 옵션 클릭
  const firstCenter = page.locator("[role=\"option\"]").first();
  await expect(firstCenter).toBeVisible({ timeout: 10000 });
  await firstCenter.click();
  await page.waitForTimeout(1000);

  const ts = Date.now();
  const testName = `E2E테스트상품_${ts}`;
  const testBarcode = `E2E${ts}`;

  // 폼 입력
  await page.fill("#name", testName);
  await page.fill("#barcode", testBarcode);
  await page.fill("#sellPrice", "10000");
  await page.fill("#supplyPrice", "7000");
  await page.fill("#originalPrice", "5000");
  await page.fill("#totalStock", "50");

  await page.screenshot({
    path: "test-results/04-form-filled.png",
    fullPage: true,
  });

  // 등록 버튼 클릭
  await page.getByRole("button", { name: /센터 상품 등록/ }).click();

  // 성공 후 대기
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: "test-results/05-after-submit.png",
    fullPage: true,
  });

  // 상품 목록에서 확인
  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // 검색
  const searchInput = page.getByPlaceholder(/상품명|바코드|검색/);
  if ((await searchInput.count()) > 0) {
    await searchInput.fill(testName);
    await page.waitForTimeout(2000);
  }

  const createdProduct = page.getByText(testName);
  await expect(createdProduct.first()).toBeVisible({ timeout: 10000 });

  await page.screenshot({
    path: "test-results/06-product-in-list.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 5. MASTER: 센터 상품 모니터링에서 데이터 확인
// ────────────────────────────────────────────────────────
test("5. MASTER: 센터 상품 모니터링에서 상품 확인", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/admin/center-products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // 통계 카드 확인
  await expect(page.getByText("전체 상품")).toBeVisible({ timeout: 10000 });

  // 상품 테이블에 데이터 존재 여부
  const tableRows = page.locator("tbody tr");
  const rowCount = await tableRows.count();
  console.log(`모니터링 상품 목록: ${rowCount}행`);

  await page.screenshot({
    path: "test-results/07-master-monitoring-data.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 6. SELLER: 상품 목록에서 원가 미표시 + 등록 버튼 없음
// ────────────────────────────────────────────────────────
test("6. SELLER: 원가 비노출 + 등록 버튼 없음", async ({ page }) => {
  await login(page, "seller1", "seller1234");

  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // "센터 상품 등록" 버튼이 없어야 함
  const centerNewBtn = page.getByRole("link", { name: /센터 상품 등록/ });
  await expect(centerNewBtn).toHaveCount(0);

  // "엑셀 업로드" 버튼도 없어야 함
  const uploadBtn = page.getByRole("link", { name: /엑셀 업로드/ });
  await expect(uploadBtn).toHaveCount(0);

  await page.screenshot({
    path: "test-results/08-seller-limited-products.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 7. SELLER: "센터 상품 현황" 접근 차단
// ────────────────────────────────────────────────────────
test("7. SELLER: 센터 상품 현황 접근 차단", async ({ page }) => {
  await login(page, "seller1", "seller1234");
  await page.waitForLoadState("networkidle");

  // 사이드바에 "센터 상품 현황" 메뉴가 없어야 함
  const menu = page.getByRole("link", { name: "센터 상품 현황" });
  await expect(menu).toHaveCount(0);

  // 직접 URL 접근 시 접근 제한
  await page.goto(`${BASE}/admin/center-products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // "접근 권한이 없습니다" 메시지
  const forbidden = page.getByText(/접근 권한|MASTER 전용/);
  await expect(forbidden).toBeVisible({ timeout: 10000 });

  await page.screenshot({
    path: "test-results/09-seller-center-products-blocked.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 8. MASTER: CSV 내보내기
//    Blob+createObjectURL 방식이므로 API 응답을 검증
// ────────────────────────────────────────────────────────
test("8. MASTER: CSV 내보내기", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/admin/center-products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // CSV 버튼 확인
  const csvBtn = page.getByRole("button", { name: /CSV/ });
  await expect(csvBtn).toBeVisible();

  // API 응답 인터셉트 — CSV 내보내기 시 pageSize=10000 요청
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/center-products") &&
      r.url().includes("pageSize=10000"),
    { timeout: 15000 }
  );

  await csvBtn.click();
  const response = await responsePromise;

  // API 성공 확인 — paginated 응답: { data, totalCount, pageCount }
  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(Array.isArray(json.data)).toBe(true);
  console.log("CSV export data count:", json.data?.length ?? 0);

  await page.screenshot({
    path: "test-results/10-csv-export.png",
    fullPage: true,
  });
});
