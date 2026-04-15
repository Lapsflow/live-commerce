import { test, expect } from '@playwright/test';

/**
 * @barcode @integration
 * Phase 2: 바코드 검색 플로우 E2E 테스트
 *
 * 테스트 플로우:
 * 1. 로그인
 * 2. 바코드 페이지 이동
 * 3. 바코드 입력
 * 4. 상품 정보 표시 확인
 * 5. 시세 정보 확인
 * 6. AI 분석 결과 확인 (optional)
 */

test.describe('바코드 검색 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', process.env.TEST_SELLER_EMAIL || 'seller@test.com');
    await page.fill('input[name="password"]', process.env.TEST_SELLER_PASSWORD || 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('바코드 입력으로 상품 검색 성공', async ({ page }) => {
    // 바코드 페이지로 이동
    await page.goto('/barcode');
    await expect(page.locator('h1')).toContainText('바코드');

    // 바코드 입력 필드 확인
    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await expect(barcodeInput).toBeVisible();

    // 테스트 바코드 입력 (실제 DB에 있는 바코드 사용)
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    // 상품 정보 표시 대기
    await page.waitForTimeout(1000);

    // 상품 정보 카드 확인
    const productCard = page.locator('text=상품 정보').locator('..');
    await expect(productCard).toBeVisible({ timeout: 5000 });

    // 기본 정보 확인
    await expect(page.locator('text=바코드')).toBeVisible();
    await expect(page.locator('text=상품코드')).toBeVisible();
    await expect(page.locator('text=판매가')).toBeVisible();
    await expect(page.locator('text=공급가')).toBeVisible();
  });

  test('시세 정보 카드 표시 확인', async ({ page }) => {
    await page.goto('/barcode');

    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(1000);

    // 시세 정보 카드 확인
    const pricingCard = page.locator('text=시세 정보').locator('..');

    // 카드가 로딩 중이거나 표시되는지 확인
    await expect(
      pricingCard.or(page.locator('text=시세 조회 중'))
    ).toBeVisible({ timeout: 5000 });

    // 시세 정보가 로드되면 내용 확인
    if (await pricingCard.isVisible()) {
      // 네이버/쿠팡 시세가 있으면 표시되어야 함
      const hasNaverPrice = await page.locator('text=네이버').count() > 0;
      const hasCoupangPrice = await page.locator('text=쿠팡').count() > 0;

      // 최소한 하나는 표시되어야 함
      expect(hasNaverPrice || hasCoupangPrice).toBeTruthy();
    }
  });

  test('창고별 재고 테이블 표시', async ({ page }) => {
    await page.goto('/barcode');

    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(1000);

    // 창고 재고 테이블 확인
    await expect(page.locator('text=창고별 재고')).toBeVisible({ timeout: 5000 });

    // 테이블 행 확인
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible();

    // 최소 1개 창고 정보 표시
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('잘못된 바코드 입력 시 에러 처리', async ({ page }) => {
    await page.goto('/barcode');

    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('0000000000000'); // 존재하지 않는 바코드
    await barcodeInput.press('Enter');

    await page.waitForTimeout(1000);

    // 에러 메시지 또는 "상품 없음" 메시지 확인
    await expect(
      page.locator('text=찾을 수 없습니다').or(page.locator('text=없습니다'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('AI 분석 카드 표시 확인', async ({ page }) => {
    await page.goto('/barcode');

    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(1000);

    // AI 분석 카드 확인
    const aiCard = page.locator('text=AI 분석').locator('..');

    // 카드가 로딩 중이거나 표시되는지 확인
    await expect(
      aiCard.or(page.locator('text=AI가 분석 중'))
    ).toBeVisible({ timeout: 5000 });

    // AI 분석이 완료되면 내용 확인
    if (await aiCard.isVisible() && !(await page.locator('text=AI가 분석 중').isVisible())) {
      // 주요 섹션 확인
      const hasKeyPoints = await page.locator('text=핵심 포인트').count() > 0;
      const hasTarget = await page.locator('text=타겟').count() > 0;
      const hasScript = await page.locator('text=방송 멘트').count() > 0;

      // 최소한 하나는 표시되어야 함
      expect(hasKeyPoints || hasTarget || hasScript).toBeTruthy();
    }
  });

  test('주문 입력 카드 기능 확인', async ({ page }) => {
    await page.goto('/barcode');

    const barcodeInput = page.locator('input[placeholder*="바코드"]');
    await barcodeInput.fill('8801234567890');
    await barcodeInput.press('Enter');

    await page.waitForTimeout(1000);

    // 주문 입력 카드 확인
    await expect(page.locator('text=주문 입력')).toBeVisible({ timeout: 5000 });

    // 수량 입력 필드 확인
    const quantityInput = page.locator('input[type="number"]').first();
    await expect(quantityInput).toBeVisible();

    // 수량 변경
    await quantityInput.fill('5');

    // 추가 버튼 클릭
    await page.click('button:has-text("추가")');

    // 주문 목록에 추가되었는지 확인
    await expect(page.locator('text=주문 목록')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=5개')).toBeVisible();
  });
});
