import { test, expect } from '@playwright/test';

/**
 * MASTER 계정 로그인 검증 테스트
 *
 * 목적: username 필드 마이그레이션 후 로그인 기능 확인
 *
 * 테스트 시나리오:
 * 1. 로그인 페이지 접속
 * 2. username: "master" 입력
 * 3. password: "master1234" 입력
 * 4. 로그인 버튼 클릭
 * 5. 대시보드로 리다이렉트 확인
 */

test.describe('MASTER 계��� 로그인', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  const BASE_URL = 'https://live-commerce-opal.vercel.app';

  test('master 계정으로 정상 로그인', async ({ page }) => {
    // 1. 로그인 페이지 이동
    await page.goto(`${BASE_URL}/login`);

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');

    // 2. 아이디 입력 (username)
    const usernameInput = page.locator('input[type="text"]').first();
    await usernameInput.fill('master');

    // 3. 비밀번호 입력
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('master1234');

    // 4. 로그인 버튼 클릭
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // 5. 리다이렉트 대기 및 확인
    await page.waitForURL(/\/(dashboard|home|main)/, { timeout: 10000 });

    // 6. 성공 확인: URL이 로그인 페이지가 아님
    expect(page.url()).not.toContain('/login');

    // 7. 추가 확인: 인증된 사용자만 볼 수 있는 요소 존재
    // (대시보드 헤딩 또는 사이드바 네비게이션)
    const isAuthenticated = await page.locator('h1, nav, aside').first().isVisible()
      .catch(() => false);

    expect(isAuthenticated).toBeTruthy();
  });

  test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Wait for input to be interactive (hydration)
    await page.locator('input[type="text"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // 아이디는 맞지만 비밀번호가 틀림
    await page.locator('input[type="text"]').first().fill('master');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 표시 확인 — "로그인에 실패했습니다" or "올바르지 않습니다"
    await expect(page.locator('text=실패').or(page.locator('text=올바르지')))
      .toBeVisible({ timeout: 15000 });

    // 여전히 로그인 페이지에 머물러 있음
    expect(page.url()).toContain('/login');
  });

  test('존재하지 않는 username으로 로그인 실패', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.locator('input[type="text"]').first().fill('nonexistentuser');
    await page.locator('input[type="password"]').fill('anypassword');
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 표시 확인
    await expect(page.locator('text=실패').or(page.locator('text=올바르지')))
      .toBeVisible({ timeout: 15000 });
  });
});

test.describe('마이그레이션 검증', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('username 필드로 로그인 가능 확인', async ({ browser }) => {
    // Use fresh context WITHOUT auth to verify login works with username
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('https://live-commerce-opal.vercel.app/login');
    await page.waitForLoadState('networkidle');

    // Wait for input to be interactive (hydration)
    await page.locator('input[type="text"]').first().waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('input[type="text"]').first().fill('admin1');
    await page.locator('input[type="password"]').fill('admin1234');
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await page.waitForURL(/\/(dashboard|home|main)/, { timeout: 15000 });
    expect(page.url()).not.toContain('/login');

    await context.close();
  });
});
