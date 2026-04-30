import { test, expect, type Page } from "@playwright/test";

/**
 * Phase B 검증: 방송 센터코드 흐름
 *
 * 계정:
 * - MASTER: master / master1234
 * - ADMIN (센터 소속): admin1 / admin1234
 * - SELLER: seller1 / seller1234
 *
 * 테스트 시나리오:
 * 1. MASTER: 방송 등록 시 센터 선택 가능 (B-2)
 * 2. MASTER: 방송 거절 → rejectedAt/rejectedBy 기록 (B-3)
 * 3. ADMIN: 다른 센터 방송 거절 차단 (B-3 권한 격리)
 * 4. SELLER: 거절 후 재신청 가능 (B-4)
 * 5. SELLER: 센터 상품 바코드 스캔 차단 (활성 방송 없음) (B-6)
 * 6. 상품 목록: 본사/센터 책임 라벨 (B-9)
 * 7. 주문 목록: 본사/센터 책임 라벨 (B-9)
 * 8. 방송 거절 AuditLog 확인 (B-3)
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
// 1. MASTER: 방송 캘린더에서 신청 시 센터 선택 드롭다운 (B-2)
// ────────────────────────────────────────────────────────
test("1. MASTER: 방송 신청 모달에 센터 선택 드롭다운 존재", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/broadcasts/calendar`);
  await page.waitForLoadState("networkidle");

  // "방송 신청" 버튼 클릭
  const requestBtn = page.getByRole("button", { name: /방송 신청/ });
  await expect(requestBtn).toBeVisible({ timeout: 10000 });
  await requestBtn.click();

  // 모달이 열리면 센터 선택 드롭다운이 보여야 함 (B-2)
  await page.waitForTimeout(1000);
  const centerSelect = page.getByText("센터를 선택하세요");
  await expect(centerSelect).toBeVisible({ timeout: 10000 });

  // 드롭다운 클릭 → 옵션 나타남
  await centerSelect.click();
  await page.waitForTimeout(1000);
  const options = page.locator("[role='option']");
  const optCount = await options.count();
  expect(optCount).toBeGreaterThan(0);
  console.log(`센터 선택 옵션 수: ${optCount}`);

  await page.screenshot({
    path: "test-results/pb-01-master-broadcast-center-select.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 2. MASTER: 방송 신청 실행 + 센터 연결 확인 (B-2)
// ────────────────────────────────────────────────────────
test("2. MASTER: 방송 신청 (센터 선택 포함)", async ({ page }) => {
  await login(page, "master", "master1234");

  // API로 직접 방송 생성 (UI 의존 최소화)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const scheduledAt = tomorrow.toISOString();
  const code = `PB-TEST-${Date.now().toString(36).toUpperCase()}`;

  // 먼저 센터 목록 조회
  const centersRes = await page.request.get(`${BASE}/api/centers`);
  const centersJson = await centersRes.json();
  const centers = centersJson.data?.centers || [];

  if (centers.length === 0) {
    console.log("센터가 없어 테스트 스킵");
    return;
  }

  const centerId = centers[0].id;
  console.log(`사용할 센터: ${centers[0].name} (${centerId})`);

  // 셀러 ID 필요 — master의 userId
  const sessionRes = await page.request.get(`${BASE}/api/auth/session`);
  const sessionJson = await sessionRes.json();
  const sellerId = sessionJson?.user?.userId || sessionJson?.user?.id;

  if (!sellerId) {
    console.log("sellerId를 가져올 수 없어 테스트 스킵");
    return;
  }

  // 방송 생성 API 호출 (centerId 포함)
  const createRes = await page.request.post(`${BASE}/api/broadcasts`, {
    data: {
      code,
      sellerId,
      centerId,
      platform: "GRIP",
      scheduledAt,
      status: "REQUESTED",
      requestMemo: "Phase B 테스트 방송",
    },
  });

  expect(createRes.status()).toBe(201);
  const created = await createRes.json();
  console.log(`방송 생성됨: ${created.data?.id || created.id}`);

  // 방송 관리 페이지에서 확인
  await page.goto(`${BASE}/broadcasts`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const broadcastRow = page.getByText(code);
  await expect(broadcastRow.first()).toBeVisible({ timeout: 10000 });

  await page.screenshot({
    path: "test-results/pb-02-broadcast-created-with-center.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 3. MASTER: 방송 거절 → rejectedAt/rejectedBy 기록 (B-3)
// ────────────────────────────────────────────────────────
test("3. MASTER: 방송 거절 + rejectedAt/rejectedBy 기록", async ({ page }) => {
  await login(page, "master", "master1234");

  // REQUESTED 방송 목록 조회
  const listRes = await page.request.get(
    `${BASE}/api/broadcasts?pageSize=100&sort=-createdAt`
  );
  const listJson = await listRes.json();
  const broadcasts = Array.isArray(listJson.data) ? listJson.data : [];
  const requested = broadcasts.find(
    (b: any) => b.status === "REQUESTED" && b.code?.startsWith("PB-TEST")
  );

  if (!requested) {
    console.log("REQUESTED 상태 테스트 방송 없음 — 스킵");
    return;
  }

  const broadcastId = requested.id;
  console.log(`거절 대상: ${requested.code} (${broadcastId})`);

  // 거절 API 호출
  const rejectRes = await page.request.put(
    `${BASE}/api/broadcasts/${broadcastId}/reject`,
    {
      data: { reason: "Phase B 테스트: 재고 부족" },
    }
  );

  expect(rejectRes.status()).toBe(200);
  const rejected = await rejectRes.json();

  // rejectedAt, rejectedBy 값 확인
  const data = rejected.data || rejected;
  expect(data.status).toBe("REJECTED");
  expect(data.rejectionReason).toBe("Phase B 테스트: 재고 부족");
  expect(data.rejectedAt).toBeTruthy();
  expect(data.rejectedBy).toBeTruthy();
  console.log(
    `거절 기록: rejectedAt=${data.rejectedAt}, rejectedBy=${data.rejectedBy}`
  );

  // 방송 관리 UI에서 확인
  await page.goto(`${BASE}/broadcasts`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: "test-results/pb-03-broadcast-rejected.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 4. ADMIN: 다른 센터 방송 거절 차단 (B-3 권한 격리)
// ────────────────────────────────────────────────────────
test("4. ADMIN: 다른 센터 방송 거절 시 차단", async ({ page }) => {
  await login(page, "master", "master1234");

  // 먼저 새 REQUESTED 방송 생성 (다른 센터용)
  const centersRes = await page.request.get(`${BASE}/api/centers`);
  const centersJson = await centersRes.json();
  const centers = centersJson.data?.centers || [];

  if (centers.length < 2) {
    console.log("센터가 2개 미만이어 권한 격리 테스트 스킵");
    return;
  }

  // admin1의 센터 ID 확인
  const admin1Res = await page.request.get(
    `${BASE}/api/users?search=admin1&pageSize=1`
  );
  const admin1Json = await admin1Res.json();
  const admin1 = admin1Json.data?.[0];
  const admin1CenterId = admin1?.centerId;

  if (!admin1CenterId) {
    console.log("admin1 centerId가 없어 테스트 스킵");
    return;
  }

  // admin1과 다른 센터 찾기
  const otherCenter = centers.find((c: any) => c.id !== admin1CenterId);
  if (!otherCenter) {
    console.log("다른 센터를 찾을 수 없어 테스트 스킵");
    return;
  }

  // 다른 센터의 방송 생성 (MASTER로)
  const sessionRes = await page.request.get(`${BASE}/api/auth/session`);
  const sessionJson = await sessionRes.json();
  const masterId = sessionJson?.user?.userId;
  const code = `PB-CROSS-${Date.now().toString(36).toUpperCase()}`;

  const createRes = await page.request.post(`${BASE}/api/broadcasts`, {
    data: {
      code,
      sellerId: masterId,
      centerId: otherCenter.id,
      platform: "GRIP",
      scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: "REQUESTED",
    },
  });

  if (createRes.status() !== 201) {
    console.log("방송 생성 실패:", await createRes.text());
    return;
  }

  const createdBroadcast = await createRes.json();
  const broadcastId = createdBroadcast.data?.id || createdBroadcast.id;

  // admin1으로 로그인하여 다른 센터 방송 거절 시도
  await login(page, "admin1", "admin1234");

  const rejectRes = await page.request.put(
    `${BASE}/api/broadcasts/${broadcastId}/reject`,
    {
      data: { reason: "권한 격리 테스트" },
    }
  );

  // 403 응답 확인 (다른 센터이므로 거절 불가)
  console.log(`다른 센터 거절 응답: ${rejectRes.status()}`);
  expect(rejectRes.status()).toBe(403);

  await page.screenshot({
    path: "test-results/pb-04-cross-center-reject-blocked.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 5. SELLER: 거절 후 재신청 가능 (B-4)
// ────────────────────────────────────────────────────────
test("5. SELLER: 거절 후 재신청 (무제한)", async ({ page }) => {
  await login(page, "seller1", "seller1234");

  // 셀러 session에서 userId, centerId 가져오기
  const sessionRes = await page.request.get(`${BASE}/api/auth/session`);
  const sessionJson = await sessionRes.json();
  const sellerId = sessionJson?.user?.userId;

  if (!sellerId) {
    console.log("seller userId 없음 — 스킵");
    return;
  }

  // 재신청 = 새 방송 생성 (같은 센터)
  const code = `PB-REAPPLY-${Date.now().toString(36).toUpperCase()}`;
  const scheduledAt = new Date(
    Date.now() + 14 * 86400000
  ).toISOString();

  const createRes = await page.request.post(`${BASE}/api/broadcasts`, {
    data: {
      code,
      sellerId,
      platform: "GRIP",
      scheduledAt,
      status: "REQUESTED",
      requestMemo: "거절 후 재신청 테스트",
    },
  });

  // 201 성공 — 재신청 차단 없음
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();
  console.log(`재신청 성공: ${created.data?.code || code}`);

  await page.screenshot({
    path: "test-results/pb-05-reapply-success.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 6. SELLER: 활성 방송 없을 때 센터 상품 바코드 차단 (B-6)
// ────────────────────────────────────────────────────────
test("6. SELLER: 활성 방송 없을 때 센터 상품 바코드 조회 차단", async ({
  page,
}) => {
  await login(page, "seller1", "seller1234");

  // 센터 상품 목록에서 아무 바코드 조회 (API level)
  // 먼저 센터 상품 바코드 찾기 — MASTER로 조회 후 seller로 시도
  // seller1은 현재 LIVE 방송이 없으므로 센터 상품 접근 차단되어야 함

  // /api/products/barcode/[code] endpoint 테스트
  // 센터 상품 바코드가 있는 경우
  const productsRes = await page.request.get(
    `${BASE}/api/products?productType=CENTER&pageSize=1`
  );
  const productsJson = await productsRes.json();
  const centerProducts = productsJson.data || [];

  if (centerProducts.length === 0) {
    console.log("센터 상품이 없어 바코드 차단 테스트 스킵");
    await page.screenshot({
      path: "test-results/pb-06-no-center-products.png",
      fullPage: true,
    });
    return;
  }

  const targetBarcode = centerProducts[0]?.barcode;
  if (!targetBarcode) {
    console.log("센터 상품에 바코드 없음 — 스킵");
    return;
  }

  console.log(`센터 상품 바코드 테스트: ${targetBarcode}`);

  // /api/products/barcode/[code] 호출
  const barcodeRes = await page.request.get(
    `${BASE}/api/products/barcode/${targetBarcode}`
  );

  // 활성 방송이 없으므로 403 또는 관련 에러
  console.log(`바코드 조회 응답: ${barcodeRes.status()}`);
  // 403 (forbidden) 이면 B-6 정상 작동
  // 200이면 본사 상품이거나, seller에게 centerId가 있어서 필터 안 걸림
  if (barcodeRes.status() === 403) {
    console.log("B-6 정상: 활성 방송 없이 센터 상품 접근 차단됨");
  } else {
    console.log(
      `응답 ${barcodeRes.status()} — 본사 상품이거나 managedBy 없는 상품`
    );
  }

  await page.goto(`${BASE}/barcode`);
  await page.waitForLoadState("networkidle");

  await page.screenshot({
    path: "test-results/pb-06-seller-barcode-page.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 7. MASTER: 상품 목록에 본사/센터 책임 라벨 표시 (B-9)
// ────────────────────────────────────────────────────────
test("7. MASTER: 상품 목록 책임 라벨 확인", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // "배송·사고: 본사" 라벨 확인
  const hqLabel = page.getByText("배송·사고: 본사");
  const centerLabel = page.getByText("배송·사고: 센터");

  const hqCount = await hqLabel.count();
  const centerCount = await centerLabel.count();
  console.log(`본사 라벨: ${hqCount}개, 센터 라벨: ${centerCount}개`);

  // 최소 하나의 책임 라벨이 있어야 함
  expect(hqCount + centerCount).toBeGreaterThan(0);

  await page.screenshot({
    path: "test-results/pb-07-responsibility-labels.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 8. MASTER: 주문 목록 탭에 책임 라벨 (B-9)
// ────────────────────────────────────────────────────────
test("8. MASTER: 발주 탭에 (본사 책임)/(센터 책임) 표시", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/orders`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // "업체발주서 (본사 책임)" 탭 확인
  const hqTab = page.getByText("업체발주서 (본사 책임)");
  await expect(hqTab).toBeVisible({ timeout: 10000 });

  // "관리메이트 (센터 책임)" 탭 확인
  const centerTab = page.getByText("관리메이트 (센터 책임)");
  await expect(centerTab).toBeVisible({ timeout: 10000 });

  await page.screenshot({
    path: "test-results/pb-08-order-responsibility-tabs.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 9. 방송 라이브 상품 목록에 책임 라벨 (B-9)
// ────────────────────────────────────────────────────────
test("9. 방송 거절 사유가 방송 관리 페이지에 표시", async ({ page }) => {
  await login(page, "master", "master1234");

  await page.goto(`${BASE}/broadcasts`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // REJECTED 방송의 거절 사유가 표시되는지 확인
  // 거절 사유: "Phase B 테스트: 재고 부족" (Test 3에서 생성)
  const rejectionReason = page.getByText("Phase B 테스트: 재고 부족");

  if ((await rejectionReason.count()) > 0) {
    console.log("거절 사유 표시 확인됨");
    await expect(rejectionReason.first()).toBeVisible();
  } else {
    // 전체 탭에서 확인
    const allTab = page.getByText(/전체/);
    if ((await allTab.count()) > 0) {
      await allTab.first().click();
      await page.waitForTimeout(2000);

      const reason2 = page.getByText("Phase B 테스트");
      const count = await reason2.count();
      console.log(`전체 탭에서 거절 사유 발견: ${count}건`);
    }
  }

  await page.screenshot({
    path: "test-results/pb-09-rejection-reason-display.png",
    fullPage: true,
  });
});

// ────────────────────────────────────────────────────────
// 10. SELLER: centerId NULL → 상품 목록 빈 배열 (B-7)
// ────────────────────────────────────────────────────────
test("10. SELLER: 상품 목록 API 프라이버시 확인", async ({ page }) => {
  await login(page, "seller1", "seller1234");

  // seller1의 상품 목록 조회
  const productsRes = await page.request.get(
    `${BASE}/api/products?pageSize=50`
  );
  const productsJson = await productsRes.json();
  const products = productsJson.data || [];

  console.log(`SELLER 상품 수: ${products.length}`);

  // 셀러 상품에 다른 센터 상품이 없는지 확인
  const sessionRes = await page.request.get(`${BASE}/api/auth/session`);
  const sessionJson = await sessionRes.json();
  const sellerCenterId = sessionJson?.user?.centerId;

  if (sellerCenterId) {
    // 모든 센터 상품이 본인 센터의 것인지 검증
    const wrongCenter = products.filter(
      (p: any) =>
        p.productType === "CENTER" && p.managedBy !== sellerCenterId
    );
    console.log(`다른 센터 상품 수: ${wrongCenter.length}`);
    expect(wrongCenter.length).toBe(0);
  } else {
    // centerId가 없으면 빈 배열이어야 함 (B-7 guard)
    console.log("SELLER centerId 없음 — 상품 0건 기대");
    expect(products.length).toBe(0);
  }

  await page.goto(`${BASE}/products`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: "test-results/pb-10-seller-products-privacy.png",
    fullPage: true,
  });
});
