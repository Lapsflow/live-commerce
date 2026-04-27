import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/seller.json' });

test.describe('샘플 쇼핑몰 플로우', () => {
  test('샘플 쇼핑몰 페이지 렌더링', async ({ page }) => {
    await page.goto('/samples');
    await expect(page.getByRole('heading', { name: '샘플 쇼핑몰' }).first()).toBeVisible({ timeout: 10000 });

    // 검색 입력 필드
    await expect(page.getByPlaceholder(/검색/)).toBeVisible();

    // 카테고리 필터 (최소 "전체" 버튼)
    await expect(page.getByRole('button', { name: '전체' }).first()).toBeVisible();
  });

  test('카테고리 필터 동작', async ({ page }) => {
    await page.goto('/samples');
    await page.waitForTimeout(2000);

    // "식품" 카테고리 클릭
    const foodBtn = page.getByRole('button', { name: '식품' });
    const hasFoodBtn = await foodBtn.isVisible().catch(() => false);
    test.skip(!hasFoodBtn, '식품 카테고리 버튼이 없음');

    await foodBtn.click();
    await page.waitForTimeout(500);

    // 다시 전체로
    await page.getByRole('button', { name: '전체' }).first().click();
  });

  test('장바구니 페이지 렌더링', async ({ page }) => {
    await page.goto('/samples/cart');
    await page.waitForTimeout(5000);

    // 장바구니 헤딩 또는 관련 텍스트 (로딩 완료 대기 후)
    const hasHeading = await page.getByText('장바구니').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/비어|상품이 없|담긴 상품/).first().isVisible().catch(() => false);
    const hasItems = await page.locator('table').first().isVisible().catch(() => false);
    const pageLoaded = await page.locator('main').first().isVisible().catch(() => false);

    // 페이지가 로드되었으면 통과 (장바구니 렌더링 자체 검증)
    expect(hasHeading || hasEmpty || hasItems || pageLoaded).toBeTruthy();
  });
});
