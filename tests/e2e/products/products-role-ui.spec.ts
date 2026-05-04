import { test, expect } from '@playwright/test';

test.describe('상품 관리 — SELLER 역할', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('SELLER는 상품 추가/수정 버튼이 없다', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: '상품 관리', exact: true }).first()).toBeVisible({ timeout: 10000 });

    // 모든 액션 버튼 숨김 확인
    await expect(page.getByText('상품 추가', { exact: true })).not.toBeVisible();
    await expect(page.getByText('센터 상품 등록')).not.toBeVisible();
    await expect(page.getByRole('button', { name: '엑셀 업로드' })).not.toBeVisible();
    await expect(page.getByText('재고 초기화')).not.toBeVisible();
  });
});

test.describe('상품 관리 — MASTER 역할 (센터 상품)', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('MASTER는 "센터 상품 등록" 버튼이 보인다', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: '상품 관리', exact: true }).first()).toBeVisible({ timeout: 10000 });

    // "센터 상품 등록" 표시
    await expect(page.getByText('센터 상품 등록')).toBeVisible();
    await expect(page.getByRole('button', { name: '엑셀 업로드' })).toBeVisible();
  });
});

test.describe('상품 관리 — MASTER 역할', () => {
  test.use({ storageState: 'playwright/.auth/master.json' });

  test('MASTER는 "상품 추가" 버튼이 보인다', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: '상품 관리', exact: true }).first()).toBeVisible({ timeout: 10000 });

    // MASTER 전용 버튼
    await expect(page.getByText('상품 추가', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '엑셀 업로드' })).toBeVisible();
  });
});
