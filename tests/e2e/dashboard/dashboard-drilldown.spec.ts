import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('대시보드 드릴다운 모달', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    // 스켈레톤 로딩 완료 대기
    await page.waitForSelector('.cursor-pointer', { timeout: 15000 });
  });

  test('총 매출 카드 클릭 시 매출 상세 모달 열림', async ({ page }) => {
    const salesCard = page.locator('.cursor-pointer').filter({ hasText: '총 매출' });
    await salesCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('매출 상세 (셀러별 TOP 5)')).toBeVisible();

    // 로딩 완료 대기 (테이블 또는 빈 상태가 나타날 때까지)
    await expect(
      dialog.locator('table').or(dialog.getByText('데이터가 없습니다'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('판매 건수 카드 클릭 시 판매건수 상세 모달 열림', async ({ page }) => {
    const countCard = page.locator('.cursor-pointer').filter({ hasText: '판매 건수' });
    await countCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('판매건수 상세 (상품별 TOP 5)')).toBeVisible();
  });

  test('평균 단가 카드 클릭 시 평균단가 상세 모달 열림', async ({ page }) => {
    const avgCard = page.locator('.cursor-pointer').filter({ hasText: '평균 단가' });
    await avgCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('평균단가 상세 (상품별 TOP 5)')).toBeVisible();
  });

  test('총 마진 카드 클릭 시 마진 상세 모달 열림', async ({ page }) => {
    const marginCard = page.locator('.cursor-pointer').filter({ hasText: '총 마진' });
    await marginCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('마진 상세 (상품별 TOP 5)')).toBeVisible();
  });

  test('모달 닫기 동작 확인', async ({ page }) => {
    const salesCard = page.locator('.cursor-pointer').filter({ hasText: '총 매출' });
    await salesCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // ESC로 닫기
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
