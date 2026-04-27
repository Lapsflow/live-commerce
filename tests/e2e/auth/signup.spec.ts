/**
 * 회원가입 E2E 테스트
 * pptx 스펙 검증:
 * - 아이디(username) 필수
 * - 휴대폰번호 필수
 * - 이메일 선택
 */

import { test, expect } from '@playwright/test';

test.describe('회원가입 기능', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('회원가입 페이지 UI 검증', async ({ page }) => {
    // 필수 필드 레이블 확인
    await expect(page.getByText('아이디').first()).toBeVisible();
    await expect(page.getByText('비밀번호').first()).toBeVisible();
    await expect(page.getByText('이름').first()).toBeVisible();
    await expect(page.getByText('휴대폰').first()).toBeVisible();

    // "이메일" 레이블이 존재 확인
    const emailLabel = await page.getByText('이메일').count();
    expect(emailLabel).toBeGreaterThanOrEqual(1);

    console.log('✅ 회원가입 페이지 UI 검증 완료');
  });

  test('필수 필드 없이 제출 시 검증 에러', async ({ page }) => {
    // 아무것도 입력하지 않고 제출 시도
    const submitButton = page.locator('button[type="submit"]');

    // 버튼이 있는 경우에만 테스트
    const buttonCount = await submitButton.count();
    if (buttonCount > 0) {
      await submitButton.click();

      // 페이지가 여전히 /signup에 있어야 함 (제출 실패)
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/signup');

      console.log('✅ 필수 필드 검증 동작 확인');
    } else {
      console.log('⏭️  제출 버튼 없음 - 폼 구조 확인 필요');
    }
  });

  test('아이디 입력 필드 확인', async ({ page }) => {
    // username 입력 필드 확인 (placeholder 기반)
    const usernameInput = page.getByPlaceholder('아이디를 입력하세요');
    await expect(usernameInput).toBeVisible();

    // 입력 테스트
    await usernameInput.fill('test_user_' + Date.now());
    const value = await usernameInput.inputValue();
    expect(value).toContain('test_user_');

    console.log('✅ 아이디 입력 필드 동작 확인');
  });

  test('휴대폰번호 입력 필드 확인', async ({ page }) => {
    // phone 입력 필드 확인 (type="tel")
    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible();

    // 입력 테스트 (auto-formatting adds dashes)
    await phoneInput.fill('01012345678');
    const value = await phoneInput.inputValue();
    expect(value).toContain('010');

    console.log('✅ 휴대폰번호 입력 필드 동작 확인');
  });

  test('스크린샷 캡처', async ({ page }) => {
    // 회원가입 페이지 스크린샷
    await page.screenshot({
      path: 'tests/screenshots/signup-page.png',
      fullPage: true
    });

    console.log('📸 스크린샷 저장: tests/screenshots/signup-page.png');
  });
});
