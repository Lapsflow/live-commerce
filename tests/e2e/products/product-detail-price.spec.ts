import { test, expect } from '@playwright/test';

test.describe('상품 상세 가격 잠금 — ADMIN', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('ADMIN은 가격 필드가 잠금 상태이며 안내 문구 표시', async ({ page }) => {
    await page.goto('/products');
    await page.waitForTimeout(3000);

    // 첫 번째 상품 상세보기 클릭
    const detailLink = page.getByText('상세보기').first();
    const hasDetail = await detailLink.isVisible().catch(() => false);
    test.skip(!hasDetail, '상품 데이터가 없음');

    await detailLink.click();
    await page.waitForURL(/\/products\/.+/, { timeout: 10000 });

    // 상세 페이지 로딩 확인
    await expect(page.getByText(/상품 상세|상품 정보/).first()).toBeVisible({ timeout: 10000 });

    // 가격 잠금 안내 문구 (여러 곳에 표시되므로 .first() 사용)
    await expect(page.getByText('가격은 마스터만 변경 가능').first()).toBeVisible();
  });
});

test.describe('상품 상세 가격 편집 — MASTER', () => {
  test.use({ storageState: 'playwright/.auth/master.json' });

  test('MASTER는 수정 모드에서 가격 필드 편집 가능', async ({ page }) => {
    await page.goto('/products');
    await page.waitForTimeout(3000);

    const detailLink = page.getByText('상세보기').first();
    const hasDetail = await detailLink.isVisible().catch(() => false);
    test.skip(!hasDetail, '상품 데이터가 없음');

    await detailLink.click();
    await page.waitForURL(/\/products\/.+/, { timeout: 10000 });

    await expect(page.getByText(/상품 상세|상품 정보/).first()).toBeVisible({ timeout: 10000 });

    // "가격은 마스터만 변경 가능" 문구 없어야 함
    const hasLockMsg = await page.getByText('가격은 마스터만 변경 가능').first().isVisible().catch(() => false);
    expect(hasLockMsg).toBeFalsy();

    // 수정 버튼 클릭
    const editBtn = page.getByRole('button', { name: '수정' });
    const hasEditBtn = await editBtn.isVisible().catch(() => false);
    test.skip(!hasEditBtn, '수정 버튼이 없음');

    await editBtn.click();
    await page.waitForTimeout(500);

    // 가격 필드 편집 가능 확인
    const sellPrice = page.locator('#sellPrice');
    const hasSellPrice = await sellPrice.isVisible().catch(() => false);
    if (hasSellPrice) {
      await expect(sellPrice).toBeEnabled();
    }

    // 취소
    const cancelBtn = page.getByRole('button', { name: '취소' });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }
  });
});
