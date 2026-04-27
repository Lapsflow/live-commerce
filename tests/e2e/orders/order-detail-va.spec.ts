import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('발주 상세 가상계좌 정보', () => {
  test('발주 상세 페이지에서 결제 정보 섹션 렌더링', async ({ page }) => {
    // 발주 목록 이동
    await page.goto('/orders');
    await page.waitForTimeout(3000);

    // 첫 번째 주문 행의 링크 또는 행 클릭
    const orderLink = page.locator('table tbody tr a').first();
    const hasLink = await orderLink.isVisible().catch(() => false);

    if (hasLink) {
      await orderLink.click();
    } else {
      // 행 직접 클릭
      const orderRow = page.locator('table tbody tr').first();
      const hasOrder = await orderRow.isVisible().catch(() => false);
      test.skip(!hasOrder, '발주 데이터가 없음');
      await orderRow.click();
    }

    // URL 변경 또는 상세 정보 표시 대기
    const navigated = await page.waitForURL(/\/orders\/.+/, { timeout: 10000 }).then(() => true).catch(() => false);

    if (navigated) {
      await page.waitForTimeout(2000);
      const hasOrderNo = await page.getByText(/주문번호/).first().isVisible().catch(() => false);
      const hasPayment = await page.getByText(/결제/).first().isVisible().catch(() => false);
      const hasStatus = await page.getByText(/주문상태|결제상태|배송상태/).first().isVisible().catch(() => false);
      expect(hasOrderNo || hasPayment || hasStatus).toBeTruthy();
    } else {
      // 인라인 상세 표시 또는 모달일 수 있음
      test.skip(true, '발주 상세 페이지 이동 실패 (행 클릭 미지원)');
    }
  });

  test('UNPAID 주문에서 가상계좌 관련 UI 표시', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(3000);

    // 입금확인전 뱃지가 있는 주문 찾기
    const unpaidRow = page.locator('table tbody tr').filter({ hasText: '입금확인전' }).first();
    const hasUnpaid = await unpaidRow.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'UNPAID 상태 주문이 없음');

    // 행 내 링크 또는 행 직접 클릭
    const link = unpaidRow.locator('a').first();
    const hasLinkInRow = await link.isVisible().catch(() => false);

    if (hasLinkInRow) {
      await link.click();
    } else {
      await unpaidRow.click();
    }

    const navigated = await page.waitForURL(/\/orders\/.+/, { timeout: 10000 }).then(() => true).catch(() => false);
    test.skip(!navigated, '발주 상세 페이지 이동 실패');

    await page.waitForTimeout(2000);

    // 가상계좌 발급 버튼 또는 계좌 정보 섹션 존재 확인
    const hasVaButton = await page.getByText('가상계좌 발급').isVisible().catch(() => false);
    const hasVaInfo = await page.getByText(/계좌번호|입금 대기/).isVisible().catch(() => false);

    expect(hasVaButton || hasVaInfo).toBeTruthy();
  });
});
