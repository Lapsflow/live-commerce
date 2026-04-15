import { test, expect } from '@playwright/test';

/**
 * @samples @integration
 * Phase 5: 샘플 쇼핑몰 플로우 E2E 테스트
 *
 * 테스트 플로우:
 * 1. 로그인
 * 2. 샘플 쇼핑몰 페이지 이동
 * 3. 상품 검색
 * 4. 상품 상세 확인
 * 5. 장바구니에 담기
 * 6. 장바구니 확인
 * 7. 샘플 요청 (checkout)
 */

test.describe('샘플 쇼핑몰 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', process.env.TEST_SELLER_EMAIL || 'seller@test.com');
    await page.fill('input[name="password"]', process.env.TEST_SELLER_PASSWORD || 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('샘플 상품 검색 및 장바구니 담기', async ({ page }) => {
    // 샘플 쇼핑몰 페이지로 이동
    await page.goto('/samples');
    await expect(page.locator('h1')).toContainText('샘플 쇼핑몰');

    // 상품 카드가 표시되는지 확인
    const productCards = page.locator('[data-testid="product-card"]');
    const productCount = await productCards.count();

    if (productCount === 0) {
      test.skip('상품이 없어 테스트를 건너뜁니다');
      return;
    }

    // 첫 번째 상품 정보 저장
    const firstProduct = productCards.first();
    const productName = await firstProduct.locator('h3').textContent();

    // 검색 기능 테스트
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill(productName || '');
    await page.waitForTimeout(500); // debounce 대기

    // 검색 결과 확인
    await expect(productCards.first()).toBeVisible();

    // 장바구니 담기 버튼 클릭
    await firstProduct.locator('button:has(svg)').click();

    // Toast 알림 확인
    await expect(page.locator('text=장바구니 추가')).toBeVisible({ timeout: 3000 });
  });

  test('상품 상세 페이지에서 정보 확인', async ({ page }) => {
    await page.goto('/samples');

    const productCards = page.locator('[data-testid="product-card"]');

    if (await productCards.count() === 0) {
      test.skip('상품이 없어 테스트를 건너뜁니다');
      return;
    }

    // 상세보기 버튼 클릭
    await productCards.first().locator('button:has-text("상세보기")').click();

    // URL 변경 확인
    await page.waitForURL(/\/samples\/.+/, { timeout: 5000 });

    // 상품 정보 표시 확인
    await expect(page.locator('text=바코드')).toBeVisible();
    await expect(page.locator('text=상품코드')).toBeVisible();
    await expect(page.locator('text=판매가')).toBeVisible();
    await expect(page.locator('text=총 재고')).toBeVisible();

    // 샘플 정보 확인
    await expect(page.locator('text=샘플 정보')).toBeVisible();
    await expect(page.locator('text=무료')).toBeVisible();

    // 장바구니 담기 버튼 확인
    await expect(page.locator('button:has-text("장바구니에 담기")')).toBeVisible();
  });

  test('장바구니에서 샘플 요청 완료', async ({ page }) => {
    // 먼저 상품을 장바구니에 담기
    await page.goto('/samples');

    const productCards = page.locator('[data-testid="product-card"]');

    if (await productCards.count() === 0) {
      test.skip('상품이 없어 테스트를 건너뜁니다');
      return;
    }

    // 2개 상품을 장바구니에 담기
    for (let i = 0; i < Math.min(2, await productCards.count()); i++) {
      await productCards.nth(i).locator('button:has(svg)').click();
      await page.waitForTimeout(500);
    }

    // 장바구니 페이지로 이동
    await page.click('button:has-text("장바구니")');
    await page.waitForURL('/samples/cart', { timeout: 5000 });

    // 장바구니 아이템 확인
    await expect(page.locator('h1, h2').filter({ hasText: '장바구니' })).toBeVisible();

    const cartItems = page.locator('[data-testid="cart-item"]');
    await expect(cartItems.first()).toBeVisible();

    // 주문 요약 확인
    await expect(page.locator('text=주문 요약')).toBeVisible();
    await expect(page.locator('text=무료')).toBeVisible();

    // 샘플 요청 버튼 클릭
    await page.click('button:has-text("샘플 요청")');

    // 성공 메시지 확인
    await expect(page.locator('text=샘플 요청 완료')).toBeVisible({ timeout: 5000 });

    // Proposals 페이지로 리다이렉트 확인
    await page.waitForURL('/proposals', { timeout: 5000 });
  });

  test('장바구니에서 상품 제거', async ({ page }) => {
    // 상품을 장바구니에 담기
    await page.goto('/samples');

    const productCards = page.locator('[data-testid="product-card"]');

    if (await productCards.count() === 0) {
      test.skip('상품이 없어 테스트를 건너뜁니다');
      return;
    }

    await productCards.first().locator('button:has(svg)').click();
    await page.waitForTimeout(500);

    // 장바구니로 이동
    await page.goto('/samples/cart');

    const cartItems = page.locator('[data-testid="cart-item"]');
    const initialCount = await cartItems.count();

    if (initialCount === 0) {
      test.skip('장바구니가 비어있어 테스트를 건너뜁니다');
      return;
    }

    // 첫 번째 아이템 제거
    await cartItems.first().locator('button:has(svg)').click(); // Trash icon button

    // 제거 확인
    await expect(page.locator('text=장바구니에서 제거')).toBeVisible({ timeout: 3000 });

    // 아이템 수 감소 확인
    await page.waitForTimeout(500);
    const newCount = await cartItems.count();
    expect(newCount).toBe(initialCount - 1);
  });
});
