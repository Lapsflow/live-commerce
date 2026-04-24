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

test.describe('MASTER 계정 로그인', () => {
  const BASE_URL = 'https://live-commerce-opal.vercel.app';

  test('master 계정으로 정상 로그인', async ({ page }) => {
    // 1. 로그인 페이지 이동
    await page.goto(`${BASE_URL}/login`);

    // 페이지 로드 대기
    await expect(page).toHaveTitle(/로그인|Login/i);

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
    // (예: 로그아웃 버튼, 사용자 메뉴 등)
    const isAuthenticated = await page.locator('text=/로그아웃|Logout|님/i').isVisible()
      .catch(() => false);

    expect(isAuthenticated).toBeTruthy();
  });

  test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // 아이디는 맞지만 비밀번호가 틀림
    await page.locator('input[type="text"]').first().fill('master');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 표시 확인
    await expect(page.locator('text=/올바르지 않습니다|incorrect|invalid/i'))
      .toBeVisible({ timeout: 5000 });

    // 여전히 로그인 페이지에 머물러 있음
    expect(page.url()).toContain('/login');
  });

  test('존재하지 않는 username으로 로그인 실패', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.locator('input[type="text"]').first().fill('nonexistentuser');
    await page.locator('input[type="password"]').fill('anypassword');
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 표시 확인
    await expect(page.locator('text=/올바르지 않습니다|incorrect|invalid/i'))
      .toBeVisible({ timeout: 5000 });
  });
});

test.describe('마이그레이션 검증', () => {
  const DEBUG_API = 'https://live-commerce-opal.vercel.app/api/debug/master';

  test('DEBUG API로 username 필드 존재 확인', async ({ request }) => {
    const response = await request.get(DEBUG_API);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // MASTER 계정 존재 확인
    expect(data.found).toBe(true);

    // username 필드 확인
    expect(data.account.username).toBe('master');
    expect(data.diagnostic.usernameExists).toBe(true);
    expect(data.diagnostic.usernameValue).toBe('master');

    // 비밀번호 해시 존재 확인
    expect(data.account.hasPasswordHash).toBe(true);
    expect(data.account.passwordHashLength).toBeGreaterThan(0);
  });
});
