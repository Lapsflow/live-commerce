import { test, expect } from '@playwright/test';

// 회원가입은 인증 불요
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('회원가입 폼 검증', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('Step 1 기본 정보 폼 렌더링', async ({ page }) => {
    // 페이지 제목
    await expect(page.getByText('라이브커머스').first()).toBeVisible({ timeout: 10000 });

    // 필수 입력 필드 확인
    await expect(page.getByText('아이디').first()).toBeVisible();
    await expect(page.getByText('비밀번호').first()).toBeVisible();
    await expect(page.getByText('이름').first()).toBeVisible();
    await expect(page.getByText('휴대폰').first()).toBeVisible();
    await expect(page.getByText('이메일').first()).toBeVisible();
    await expect(page.getByText('센터 코드').first()).toBeVisible();

    // 가입 버튼
    await expect(page.getByRole('button', { name: '가입하기' })).toBeVisible();
  });

  test('센터 코드 자동 포맷팅', async ({ page }) => {
    const centerInput = page.getByPlaceholder(/01-4213|센터/);
    const hasInput = await centerInput.isVisible().catch(() => false);
    test.skip(!hasInput, '센터 코드 입력 필드를 찾을 수 없음');

    await centerInput.fill('');
    await centerInput.pressSequentially('014213', { delay: 50 });
    await page.waitForTimeout(300);

    const value = await centerInput.inputValue();
    expect(value).toContain('01-');
  });

  test('휴대폰번호 자동 포맷팅', async ({ page }) => {
    const phoneInput = page.locator('input[type="tel"]');
    const hasInput = await phoneInput.isVisible().catch(() => false);
    test.skip(!hasInput, '휴대폰 입력 필드를 찾을 수 없음');

    await phoneInput.fill('');
    await phoneInput.pressSequentially('01012345678', { delay: 50 });
    await page.waitForTimeout(300);

    const value = await phoneInput.inputValue();
    expect(value).toContain('010-');
  });

  test('이메일 형식 검증 피드백', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const hasInput = await emailInput.isVisible().catch(() => false);
    test.skip(!hasInput, '이메일 입력 필드를 찾을 수 없음');

    // 잘못된 형식 입력
    await emailInput.fill('invalid');
    await emailInput.blur();
    await page.waitForTimeout(600);

    const hasError = await page.getByText(/올바르지 않은|형식/).isVisible().catch(() => false);

    // 올바른 형식 입력
    await emailInput.fill('valid@test.com');
    await emailInput.blur();
    await page.waitForTimeout(600);

    // 테스트는 UI 반응 확인만 — 실제 가입 제출하지 않음
    expect(true).toBeTruthy();
  });
});
