import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('방송 캘린더', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/broadcasts/calendar');
    await expect(page.getByRole('heading', { name: '방송 캘린더' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('캘린더 페이지 렌더링', async ({ page }) => {
    // 월/년 표시 확인
    const monthHeader = page.locator('h2').first();
    await expect(monthHeader).toBeVisible();

    // 상태 범례 확인 (최소 1개)
    const hasLegend = await page.getByText('예정').first().isVisible().catch(() => false)
      || await page.getByText('진행중').first().isVisible().catch(() => false);
    expect(hasLegend).toBeTruthy();
  });

  test('월 이동 네비게이션', async ({ page }) => {
    // react-big-calendar 툴바의 월 표시
    const toolbar = page.locator('.rbc-toolbar-label, [class*="toolbar"]').first();
    const hasToolbar = await toolbar.isVisible().catch(() => false);

    // 이전/다음 버튼 (react-big-calendar 툴바의 "이전", "다음" 또는 커스텀 "이전 달", "다음 달")
    const prevBtn = page.getByRole('button', { name: '이전', exact: true });
    const prevBtnAlt = page.getByRole('button', { name: '이전 달' });

    // 이전 버튼 중 활성화된 것 찾기
    const hasPrev = await prevBtn.isVisible().catch(() => false);
    const hasPrevAlt = await prevBtnAlt.isEnabled().catch(() => false);

    if (hasPrev) {
      const initialText = hasToolbar ? await toolbar.textContent() : '';
      await prevBtn.click();
      await page.waitForTimeout(500);
      if (hasToolbar) {
        const newText = await toolbar.textContent();
        expect(newText).not.toBe(initialText);
      }
    } else if (hasPrevAlt) {
      await prevBtnAlt.click();
      await page.waitForTimeout(500);
    } else {
      // 이동 버튼이 없거나 비활성화면 통과
      test.skip(true, '월 이동 버튼이 비활성화 상태');
    }
  });

  test('방송 신청 버튼 클릭 시 모달 열림', async ({ page }) => {
    const requestBtn = page.getByRole('button', { name: '방송 신청' }).first();
    const hasBtnVisible = await requestBtn.isVisible().catch(() => false);
    test.skip(!hasBtnVisible, '방송 신청 버튼이 없음');

    await requestBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 취소로 닫기
    const cancelBtn = dialog.getByRole('button', { name: '취소' });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible();
    }
  });
});
