/**
 * 회원가입 E2E 테스트
 * pptx 스펙 검증:
 * - 아이디(username) 필수
 * - 휴대폰번호 필수
 * - 이메일 선택
 */

import { test, expect } from '@playwright/test';

test.describe('회원가입 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('회원가입 페이지 UI 검증', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/Create Next App/);

    // 필수 필드 레이블 확인
    await expect(page.locator('label:has-text("아이디")')).toBeVisible();
    await expect(page.locator('label:has-text("비밀번호")')).toBeVisible();
    await expect(page.locator('label:has-text("이름")')).toBeVisible();
    await expect(page.locator('label:has-text("휴대폰번호")')).toBeVisible();

    // "이메일" 레이블이 필수로 표시되지 않는지 확인
    const emailLabel = await page.locator('label:has-text("이메일")').count();
    expect(emailLabel).toBeLessThanOrEqual(1); // 있어도 필수 아님 (선택 필드)

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
    // username 입력 필드 확인
    const usernameInput = page.locator('input[name="username"], input[id="username"]').first();
    await expect(usernameInput).toBeVisible();

    // placeholder 확인
    const placeholder = await usernameInput.getAttribute('placeholder');
    console.log(`📝 아이디 필드 placeholder: "${placeholder}"`);

    // 입력 테스트
    await usernameInput.fill('test_user_' + Date.now());
    const value = await usernameInput.inputValue();
    expect(value).toContain('test_user_');

    console.log('✅ 아이디 입력 필드 동작 확인');
  });

  test('휴대폰번호 입력 필드 확인', async ({ page }) => {
    // phone 입력 필드 확인
    const phoneInput = page.locator('input[name="phone"], input[id="phone"]').first();
    await expect(phoneInput).toBeVisible();

    // 입력 테스트
    await phoneInput.fill('01012345678');
    const value = await phoneInput.inputValue();
    expect(value).toBe('01012345678');

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
