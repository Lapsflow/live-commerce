import { test, expect } from '@playwright/test';

/**
 * @broadcast @integration
 * Phase 4: 방송 시작 플로우 E2E 테스트
 *
 * 테스트 플로우:
 * 1. 로그인
 * 2. 방송 목록 페이지 이동
 * 3. 방송 시작 버튼 클릭
 * 4. 센터코드 입력 및 검증
 * 5. 방송 시작
 * 6. 라이브 페이지로 이동 확인
 */

test.describe('방송 시작 플로우', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('센터코드 입력하여 방송 시작 성공', async ({ page }) => {
    // 방송 목록 페이지로 이동
    await page.goto('/broadcasts');
    await expect(page.locator('h1')).toContainText('방송 일정');

    // 예정된 방송이 있는지 확인
    const scheduledBroadcast = page.locator('[data-status="SCHEDULED"]').first();

    if (await scheduledBroadcast.count() === 0) {
      test.skip('예정된 방송이 없어 테스트를 건너뜁니다');
      return;
    }

    // 시작 버튼 클릭
    await scheduledBroadcast.locator('button:has-text("시작")').click();

    // 다이얼로그 표시 확인
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('text=방송 시작')).toBeVisible();

    // 센터코드 입력
    const centerCodeInput = page.locator('input[placeholder*="센터코드"]');
    await centerCodeInput.fill('01-4213'); // 테스트 센터코드

    // 확인 버튼 클릭
    await page.click('button:has-text("확인")');

    // 센터 정보 표시 대기
    await expect(page.locator('text=센터 확인됨')).toBeVisible({ timeout: 5000 });

    // 방송 시작 버튼 클릭
    await page.click('button:has-text("방송 시작")');

    // 라이브 페이지로 이동 확인
    await page.waitForURL(/\/broadcasts\/.*\/live/, { timeout: 10000 });
    await expect(page.locator('badge:has-text("LIVE")')).toBeVisible();
    await expect(page.locator('text=라이브 방송')).toBeVisible();
  });

  test('잘못된 센터코드 입력 시 에러 표시', async ({ page }) => {
    await page.goto('/broadcasts');

    const scheduledBroadcast = page.locator('[data-status="SCHEDULED"]').first();

    if (await scheduledBroadcast.count() === 0) {
      test.skip('예정된 방송이 없어 테스트를 건너뜁니다');
      return;
    }

    await scheduledBroadcast.locator('button:has-text("시작")').click();
    await expect(page.locator('role=dialog')).toBeVisible();

    // 잘못된 센터코드 입력
    const centerCodeInput = page.locator('input[placeholder*="센터코드"]');
    await centerCodeInput.fill('99-9999');

    await page.click('button:has-text("확인")');

    // 에러 메시지 표시 확인
    await expect(page.locator('text=유효하지 않은')).toBeVisible({ timeout: 5000 });
  });

  test('라이브 페이지에서 상품 리스트 표시', async ({ page }) => {
    // 이미 LIVE 상태인 방송으로 이동
    await page.goto('/broadcasts');

    const liveBroadcast = page.locator('[data-status="LIVE"]').first();

    if (await liveBroadcast.count() === 0) {
      test.skip('라이브 방송이 없어 테스트를 건너뜁니다');
      return;
    }

    // 방송 ID 추출하여 라이브 페이지로 이동
    const broadcastId = await liveBroadcast.getAttribute('data-broadcast-id');
    await page.goto(`/broadcasts/${broadcastId}/live`);

    // 상품 리스트 표시 확인
    await expect(page.locator('text=상품 리스트')).toBeVisible();

    // 검색 기능 확인
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('테스트 상품');

    // 검색 결과 대기
    await page.waitForTimeout(500); // debounce 대기

    // 판매 현황 카드 확인
    await expect(page.locator('text=판매 현황')).toBeVisible();
  });
});
