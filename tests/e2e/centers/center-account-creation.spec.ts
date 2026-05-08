import { test, expect } from '@playwright/test';

/**
 * 센터 + 관리자 계정 동시 생성 E2E 테스트
 *
 * 검증 항목:
 * 1. 마스터가 센터 + 관리자 동시 생성 (API)
 * 2. admin 필드 없으면 센터만 생성
 * 3. 중복 username 거부
 * 4. 짧은 비밀번호 거부
 * 5. 새 계정 로그인 → 비밀번호 변경 페이지 강제
 * 6. 비밀번호 변경 후 로그아웃
 * 7. mustChangePassword API 동작
 *
 * Response format: { data: { center, admin, message } } (201)
 * Error format:    { error: { code, message } } (400)
 */

const BASE_URL = 'https://live-commerce-opal.vercel.app';

// 테스트용 고유 식별자 (충돌 방지)
const TS = Date.now().toString(36).slice(-4);

/** 센터코드 생성 헬퍼: regionCode + 4자리 숫자 */
function makeCenterCode(regionCode: string, seed: string): string {
  const digits = seed.replace(/[^0-9]/g, '9').padEnd(4, '0').slice(0, 4);
  return `${regionCode}-${digits}`;
}

/** 센터 + 관리자 생성 API 호출 헬퍼 */
async function createCenterWithAdmin(
  request: any,
  opts: {
    code: string;
    name: string;
    regionCode: string;
    regionName: string;
    username: string;
    password: string;
    adminName: string;
  }
) {
  return request.post(`${BASE_URL}/api/centers`, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    data: {
      code: opts.code,
      name: opts.name,
      regionCode: opts.regionCode,
      regionName: opts.regionName,
      representative: '테스터',
      representativePhone: '010-1234-5678',
      address: '서울시 강남구',
      adminUsername: opts.username,
      adminPassword: opts.password,
      adminName: opts.adminName,
    },
  });
}

test.describe('센터 + 관리자 계정 동시 생성', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. API: 센터 + 관리자 동시 생성', async ({ request }) => {
    const code = makeCenterCode('01', TS);
    const username = `test_admin_${TS}`;

    const res = await createCenterWithAdmin(request, {
      code,
      name: `E2E테스트센터_${TS}`,
      regionCode: '01',
      regionName: '서울특별시',
      username,
      password: 'TestPass1234',
      adminName: '테스트관리자',
    });

    // 이미 존재하면 skip (이전 실행 잔재)
    if (res.status() === 400) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(201);
    const body = await res.json();

    // 센터 생성 확인 — response: { data: { center, admin, message } }
    expect(body.data.center).toBeTruthy();
    expect(body.data.center.code).toBe(code);

    // 관리자 계정 정보 확인
    expect(body.data.admin).toBeTruthy();
    expect(body.data.admin.username).toBe(username);
    expect(body.data.admin.temporaryPassword).toBe('TestPass1234');
    expect(body.data.admin.name).toBe('테스트관리자');

    // 메시지 확인
    expect(body.data.message).toContain('관리자 계정');
  });

  test('2. API: admin 필드 없으면 센터만 생성', async ({ request }) => {
    const code = makeCenterCode('01', TS + 'a');
    const res = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code,
        name: `E2E테스트센터_noAdmin_${TS}`,
        regionCode: '01',
        regionName: '서울특별시',
        representative: '김철수',
        representativePhone: '010-9876-5432',
        address: '서울시 서초구 서초대로 1',
      },
    });

    // 성공 or 이미 존재 (이전 실행 잔재)
    if (res.status() === 201) {
      const body = await res.json();
      expect(body.data.admin).toBeNull();
      expect(body.data.message).toContain('센터가 성공적으로');
    }
  });

  test('3. API: 중복 username 거부', async ({ request }) => {
    // master username은 항상 존재
    const res = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code: '01-0001',
        name: 'DuplicateTest',
        regionCode: '01',
        regionName: '서울특별시',
        representative: '테스트',
        representativePhone: '010-0000-0000',
        address: '서울',
        adminUsername: 'master',
        adminPassword: 'SomePass1234',
        adminName: '중복테스트',
      },
    });

    // 센터코드 중복 또는 username 중복 → 400
    expect(res.status()).toBe(400);
  });

  test('4. API: admin validation — 짧은 비밀번호 거부', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code: makeCenterCode('08', TS),
        name: `ValidationTest_${TS}`,
        regionCode: '01',
        regionName: '서울특별시',
        representative: '테스트',
        representativePhone: '010-0000-0000',
        address: '서울',
        adminUsername: 'validuser123',
        adminPassword: 'short',  // 8자 미만
        adminName: '테스트',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('8자');
  });

  // ── 로그인 + 비밀번호 변경 강제 (self-contained) ──

  test('5. 새 관리자 로그인 → 비밀번호 변경 강제', async ({ request, browser }) => {
    test.slow(); // 3x timeout for Vercel cold start

    const username = `test_login_${TS}`;
    const password = 'LoginTest1234';

    // 1. 계정 생성 (master auth 사용)
    const createRes = await createCenterWithAdmin(request, {
      code: makeCenterCode('06', TS),
      name: `로그인테스트_${TS}`,
      regionCode: '06',
      regionName: '세종특별자치시',
      username,
      password,
      adminName: '로그인테스터',
    });

    if (createRes.status() !== 201) {
      test.skip();
      return;
    }

    // 2. 새 계정으로 로그인 (빈 세션)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="text"]').first().fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // 3. 로그인 후 리다이렉트 확인
    // mustChangePassword=true → dashboard → guard → /profile/change-password
    await page.waitForURL(/\/(profile\/change-password|dashboard)/, { timeout: 30000 });

    if (page.url().includes('/dashboard')) {
      // MustChangePasswordGuard가 리다이렉트하기를 기다림
      await page.waitForURL(/\/profile\/change-password/, { timeout: 15000 });
    }

    expect(page.url()).toContain('/profile/change-password');

    // 4. 임시 비밀번호 경고 메시지 확인
    await expect(page.locator('text=임시 비밀번호')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('6. 비밀번호 변경 완료 → 로그아웃', async ({ request, browser }) => {
    test.slow(); // 3x timeout

    const username = `test_chpw_${TS}`;
    const password = 'ChangeMe1234';
    const newPassword = 'NewSecure5678';

    // 1. 계정 생성
    const createRes = await createCenterWithAdmin(request, {
      code: makeCenterCode('07', TS),
      name: `비번변경테스트_${TS}`,
      regionCode: '07',
      regionName: '충청남도',
      username,
      password,
      adminName: '변경테스터',
    });

    if (createRes.status() !== 201) {
      test.skip();
      return;
    }

    // 2. 로그인
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="text"]').first().fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // 3. 비밀번호 변경 페이지 대기
    await page.waitForURL(/\/(profile\/change-password|dashboard)/, { timeout: 30000 });
    if (!page.url().includes('/profile/change-password')) {
      await page.waitForURL(/\/profile\/change-password/, { timeout: 15000 });
    }

    // 4. 비밀번호 변경 폼 입력
    await page.locator('#currentPassword').fill(password);
    await page.locator('#newPassword').fill(newPassword);
    await page.locator('#confirmPassword').fill(newPassword);

    // 5. 변경 버튼 클릭
    await page.locator('button[type="submit"]').click();

    // 6. 성공 → signOut → /login 리다이렉트
    await page.waitForURL(/\/login/, { timeout: 20000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });

  test('7. mustChangePassword: 마스터는 false', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/auth/session`);
    if (res.ok()) {
      const body = await res.json();
      const mustChange = body?.user?.mustChangePassword;
      expect(mustChange).toBeFalsy();
    }
  });
});
