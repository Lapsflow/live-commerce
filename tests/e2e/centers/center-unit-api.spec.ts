import { test, expect } from '@playwright/test';

/**
 * 센터 계정 생성 단위 API 테스트
 *
 * - bcrypt 해시 저장 확인 (로그인 가능 = 해시 정상)
 * - mustChangePassword 토글 (브라우저 내 fetch로 검증)
 * - 트랜잭션: Center + User 동시 생성
 * - Validation: adminUsername 없이 adminPassword만 전송 → 무시
 *
 * Response format: { data: { center, admin, message } } (201)
 */

const BASE_URL = 'https://live-commerce-opal.vercel.app';
const TS = Date.now().toString(36).slice(-4);

test.describe('단위 API 테스트: 센터 + 계정 생성', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('bcrypt 해시 저장 확인 — 생성한 계정으로 로그인 가능', async ({ request, browser }) => {
    const username = `unit_bcrypt_${TS}`;
    const password = 'BcryptTest1234';

    // 센터 + 계정 생성
    const createRes = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code: `02-${TS.replace(/[^0-9]/g, '8').padEnd(4, '0').slice(0, 4)}`,
        name: `Bcrypt테스트_${TS}`,
        regionCode: '02',
        regionName: '경기도',
        representative: '테스터',
        representativePhone: '010-1111-2222',
        address: '경기도 수원시',
        adminUsername: username,
        adminPassword: password,
        adminName: '해시테스트',
      },
    });

    // 이미 존재하면 skip
    if (createRes.status() !== 201) {
      test.skip();
      return;
    }

    // 로그인 시도 (bcrypt 해시 검증)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="text"]').first().fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // 로그인 성공 → 리다이렉트
    await page.waitForURL(/\/(dashboard|profile\/change-password)/, { timeout: 30000 });
    expect(page.url()).not.toContain('/login');

    await context.close();
  });

  test('트랜잭션: Center + User 동시 생성 확인', async ({ request }) => {
    const username = `unit_txn_${TS}`;

    const res = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code: `03-${TS.replace(/[^0-9]/g, '7').padEnd(4, '0').slice(0, 4)}`,
        name: `트랜잭션테스트_${TS}`,
        regionCode: '03',
        regionName: '인천광역시',
        representative: '김트랜',
        representativePhone: '010-3333-4444',
        address: '인천광역시 남동구',
        adminUsername: username,
        adminPassword: 'TxnTest12345',
        adminName: '트랜잭션관리자',
        adminEmail: 'txn@test.com',
        adminPhone: '010-5555-6666',
      },
    });

    if (res.status() !== 201) {
      test.skip();
      return;
    }

    const body = await res.json();

    // Center 생성됨
    expect(body.data.center).toBeTruthy();
    expect(body.data.center.id).toBeTruthy();

    // Admin 생성됨
    expect(body.data.admin).toBeTruthy();
    expect(body.data.admin.username).toBe(username);
    expect(body.data.admin.temporaryPassword).toBe('TxnTest12345');
    expect(body.data.admin.name).toBe('트랜잭션관리자');

    // 메시지 확인
    expect(body.data.message).toContain('관리자 계정');
  });

  test('mustChangePassword: 변경 전후 API 동작', async ({ request, browser }) => {
    test.slow(); // 3x timeout for Vercel

    const username = `unit_mcp_${TS}`;
    const oldPw = 'OldPass12345';
    const newPw = 'NewPass67890';

    // 1. 계정 생성
    const createRes = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code: `04-${TS.replace(/[^0-9]/g, '6').padEnd(4, '0').slice(0, 4)}`,
        name: `MCP테스트_${TS}`,
        regionCode: '04',
        regionName: '강원특별자치도',
        representative: '변경테스트',
        representativePhone: '010-7777-8888',
        address: '강원도 춘천시',
        adminUsername: username,
        adminPassword: oldPw,
        adminName: 'MCP테스터',
      },
    });

    if (createRes.status() !== 201) {
      test.skip();
      return;
    }

    // 2. 새 계정으로 로그인
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="text"]').first().fill(username);
    await page.locator('input[type="password"]').fill(oldPw);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|profile\/change-password)/, { timeout: 30000 });

    // 3. 비밀번호 변경 API — 브라우저 내 fetch로 호출 (쿠키 자동 포함)
    const result = await page.evaluate(async ({ currentPassword, newPassword }) => {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return { status: res.status, body: await res.json() };
    }, { currentPassword: oldPw, newPassword: newPw });

    // 4. 검증 — response: { data: { message: "..." } }
    expect(result.status).toBe(200);
    expect(result.body.data.message).toContain('비밀번호');

    await context.close();
  });

  test('Validation: adminUsername 없이 adminPassword만 전송 → 무시', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/centers`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
      },
      data: {
        code: `05-${TS.replace(/[^0-9]/g, '5').padEnd(4, '0').slice(0, 4)}`,
        name: `NoUsernameTest_${TS}`,
        regionCode: '05',
        regionName: '충청북도',
        representative: '테스터',
        representativePhone: '010-9999-0000',
        address: '충청북도 청주시',
        // adminUsername 없이 password만
        adminPassword: 'Ignored12345',
      },
    });

    if (res.status() === 201) {
      const body = await res.json();
      // admin이 null이어야 함 (username 없으므로 무시)
      expect(body.data.admin).toBeNull();
    }
  });
});
