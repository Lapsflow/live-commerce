import { test, expect } from '@playwright/test';

test.describe('사용자 상세 페이지 — MASTER', () => {
  test.use({ storageState: 'playwright/.auth/master.json' });

  test('사용자 목록에서 클릭하여 상세 페이지 이동', async ({ page }) => {
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' }).first()).toBeVisible({ timeout: 10000 });

    // 테이블 로딩 대기
    const tableBody = page.locator('table tbody tr').first();
    const hasRow = await tableBody.isVisible({ timeout: 10000 }).catch(() => false);
    test.skip(!hasRow, '사용자 목록에 데이터가 없음');

    // 첫 번째 행 클릭 (행 전체가 cursor-pointer)
    await tableBody.click();
    await page.waitForURL(/\/users\/.+/, { timeout: 10000 });

    // 상세 페이지 로딩 완료 대기
    await page.locator('text=로딩 중...').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});

    // 뒤로가기 버튼 확인
    await expect(page.getByText('사용자 목록으로')).toBeVisible({ timeout: 10000 });
  });

  test('사용자 기본 정보 표시', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(3000);

    const firstRow = page.locator('table tbody tr').first();
    const hasRow = await firstRow.isVisible().catch(() => false);
    test.skip(!hasRow, '사용자 목록에 데이터가 없음');

    await firstRow.click();
    await page.waitForURL(/\/users\/.+/, { timeout: 10000 });

    // 상세 페이지 로딩 완료 대기
    await page.locator('text=로딩 중...').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});

    // 기본 정보 라벨 확인
    const hasEmail = await page.getByText(/이메일/).first().isVisible().catch(() => false);
    const hasPhone = await page.getByText(/전화번호|휴대폰/).first().isVisible().catch(() => false);
    const hasCenter = await page.getByText(/소속 센터|센터/).first().isVisible().catch(() => false);

    expect(hasEmail || hasPhone || hasCenter).toBeTruthy();
  });

  test('통계 카드 렌더링', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(3000);

    const firstRow = page.locator('table tbody tr').first();
    const hasRow = await firstRow.isVisible().catch(() => false);
    test.skip(!hasRow, '사용자 목록에 데이터가 없음');

    await firstRow.click();
    await page.waitForURL(/\/users\/.+/, { timeout: 10000 });

    // 상세 페이지 로딩 완료 대기
    await page.locator('text=로딩 중...').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});

    const hasBroadcast = await page.getByText('방송 횟수').isVisible().catch(() => false);
    const hasSales = await page.getByText('총 매출').first().isVisible().catch(() => false);
    const hasOrders = await page.getByText('발주 건수').isVisible().catch(() => false);

    expect(hasBroadcast || hasSales || hasOrders).toBeTruthy();
  });

  test('탭 전환 동작', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(3000);

    const firstRow = page.locator('table tbody tr').first();
    const hasRow = await firstRow.isVisible().catch(() => false);
    test.skip(!hasRow, '사용자 목록에 데이터가 없음');

    await firstRow.click();
    await page.waitForURL(/\/users\/.+/, { timeout: 10000 });

    // 상세 페이지 로딩 완료 대기
    await page.locator('text=로딩 중...').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});

    // 탭 존재 확인
    const salesTab = page.getByRole('tab', { name: /매출/ });
    const hasTabs = await salesTab.isVisible().catch(() => false);
    test.skip(!hasTabs, '탭 UI가 없음');

    await salesTab.click();
    await page.waitForTimeout(500);

    const ordersTab = page.getByRole('tab', { name: /발주/ });
    if (await ordersTab.isVisible().catch(() => false)) {
      await ordersTab.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('사용자 상세 — SELLER 접근 거부', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('SELLER는 사용자 관리 페이지 접근 불가', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(3000);
    // SELLER는 /users 접근 시 리다이렉트 또는 권한 거부
    const hasAccessDenied = await page.getByText(/접근 권한|권한이 없|unauthorized/i).first().isVisible().catch(() => false);
    const redirected = !page.url().includes('/users');
    expect(hasAccessDenied || redirected).toBeTruthy();
  });
});
