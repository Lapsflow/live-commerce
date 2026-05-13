/**
 * Stage 4: Production Read-Only Smoke — 운영 데이터 기반 읽기 전용 검증
 *
 * 목적: 운영 환경의 실 데이터(13,000+ 재고 충돌 등)에서
 *       페이지가 정상 동작하는지 확인. 데이터 변경 절대 금지.
 *
 * 핵심 단언 (이번 hotfix 회귀 검증):
 *   A. /dashboard/onewms 페이지 정상 로드 (TypeError 없음)
 *   B. "전체 보기" 클릭 → /dashboard/onewms 진입 정상
 *   C. 재고 충돌 테이블 행 50건 이하 (페이지네이션 동작)
 *   D. 대용량 목록 페이지 DOM 폭발 없음
 *
 * ⚠️ 이 spec에서는 GET / 페이지 진입만 사용. INSERT/UPDATE/DELETE 절대 금지.
 */

import { test, expect } from '@playwright/test';
import { attachErrorWatcher, assertNoErrors } from './helpers/console-watcher';

const BASE = 'https://www.supermujin.ai';
const AUTH = 'playwright/.auth/supermujin.json';

test.describe('[Production Smoke] 운영 환경 읽기 전용 검증', () => {

  test('P1: MASTER 대시보드 → ONEWMS 위젯 → "전체 보기" → /dashboard/onewms 정상 로드', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();
    const errors = attachErrorWatcher(page);

    // 대시보드 진입
    await page.goto(`${BASE}/dashboard`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // ONEWMS 위젯 가시 확인
    const widget = page.locator('text=ONEWMS 연동 상태');
    if (await widget.isVisible({ timeout: 5000 }).catch(() => false)) {
      // "전체 보기" 링크 클릭 (Link > Button 구조이므로 클릭 + 네비게이션 대기)
      const viewAllLink = page.locator('a[href="/dashboard/onewms"]');
      if (await viewAllLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await Promise.all([
          page.waitForURL('**/dashboard/onewms', { timeout: 15000 }),
          viewAllLink.click(),
        ]);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        // /dashboard/onewms 진입 확인
        expect(page.url()).toContain('/dashboard/onewms');

        // 페이지 정상 로드 (이번 버그의 핵심 회귀 검증)
        const bodyText = (await page.locator('body').innerText()).trim();
        expect(bodyText).not.toContain("This page couldn't load");
        expect(bodyText).not.toContain('Application error');

        // ONEWMS 통합 관리 헤더 가시
        await expect(page.locator('text=ONEWMS 통합 관리')).toBeVisible({ timeout: 10000 });

        // 재고 충돌 섹션 가시
        await expect(page.locator('text=재고 충돌')).toBeVisible({ timeout: 10000 });

        // 콘솔 에러 없음 (TypeError: conflicts.map is not a function 회귀 방지)
        assertNoErrors(errors, '/dashboard → 전체 보기 → /dashboard/onewms');
      } else {
        // "전체 보기" 링크가 없으면 직접 진입
        await page.goto(`${BASE}/dashboard/onewms`, { timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        const bodyText = (await page.locator('body').innerText()).trim();
        expect(bodyText).not.toContain("This page couldn't load");
        assertNoErrors(errors, '/dashboard/onewms (direct)');
      }
    } else {
      // SUB_MASTER로 접속한 경우 ONEWMS 위젯이 안 보일 수 있음
      test.skip(true, 'ONEWMS 위젯 미가시 — MASTER 인증 확인 필요');
    }

    await ctx.close();
  });

  test('P2: /dashboard/onewms 재고 충돌 테이블 — 페이지네이션 동작 (50건 이하)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();
    const errors = attachErrorWatcher(page);

    await page.goto(`${BASE}/dashboard/onewms`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // 페이지 정상 로드
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText).not.toContain("This page couldn't load");

    // 재고 충돌 영역 대기
    await page.waitForTimeout(3000);

    // 테이블이 있으면 행 수 확인 (페이지네이션 덕분에 50건 이하여야 함)
    const table = page.locator('table tbody tr');
    const tableVisible = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false);
    if (tableVisible) {
      const rowCount = await table.count();
      expect(rowCount).toBeLessThanOrEqual(50);
      console.log(`[Production] /dashboard/onewms 테이블 행 수: ${rowCount}`);
    } else {
      // 충돌 0건이면 "재고 충돌이 없습니다" 텍스트 확인
      const noConflictText = page.locator('text=재고 충돌이 없습니다');
      const hasNoConflict = await noConflictText.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasNoConflict) {
        console.log('[Production] 재고 충돌 0건 — 테이블 미표시 정상');
      }
      // 충돌이 있지만 로딩 중일 수도 있으므로 무조건 실패시키지 않음
    }

    assertNoErrors(errors, '/dashboard/onewms 페이지네이션');

    await ctx.close();
  });

  test('P3: /dashboard/onewms API 응답 구조 — data.conflicts 배열 반환', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();

    // API 직접 호출
    const res = await page.request.get(`${BASE}/api/onewms/stock/conflicts?limit=5&offset=0`, {
      headers: { Origin: BASE },
      timeout: 15000,
    });

    if (res.status() === 401) {
      test.skip(true, 'API 인증 실패 — storageState 확인 필요');
      await ctx.close();
      return;
    }

    expect(res.status()).toBe(200);

    const json = await res.json();
    // 응답 구조 검증: { data: { conflicts: [...], count, returned, hasMore } }
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('conflicts');
    expect(Array.isArray(json.data.conflicts)).toBe(true);
    expect(json.data).toHaveProperty('count');
    expect(typeof json.data.count).toBe('number');
    expect(json.data).toHaveProperty('hasMore');
    expect(typeof json.data.hasMore).toBe('boolean');

    // 페이지네이션 동작: limit=5 → 반환 건수 5 이하
    expect(json.data.conflicts.length).toBeLessThanOrEqual(5);

    console.log(`[Production] API: 전체 ${json.data.count}건 / 반환 ${json.data.conflicts.length}건`);

    await ctx.close();
  });

  test('P4: 발주 관리 목록 — 페이지네이션 정상 (대용량 데이터 회귀)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();
    const errors = attachErrorWatcher(page);

    await page.goto(`${BASE}/orders`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText).not.toContain("This page couldn't load");
    expect(bodyText.length).toBeGreaterThan(10);

    // 테이블 행 수가 페이지 사이즈 한도 내 (DOM 폭발 방지)
    const tableVisible = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false);
    if (tableVisible) {
      const rowCount = await page.locator('table tbody tr').count();
      expect(rowCount).toBeLessThanOrEqual(100);
      console.log(`[Production] /orders 테이블 행 수: ${rowCount}`);
    }

    assertNoErrors(errors, '/orders');
    await ctx.close();
  });

  test('P5: 상품 관리 목록 — 페이지네이션 정상', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();
    const errors = attachErrorWatcher(page);

    await page.goto(`${BASE}/products`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText).not.toContain("This page couldn't load");
    expect(bodyText.length).toBeGreaterThan(10);

    const tableVisible = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false);
    if (tableVisible) {
      const rowCount = await page.locator('table tbody tr').count();
      expect(rowCount).toBeLessThanOrEqual(100);
      console.log(`[Production] /products 테이블 행 수: ${rowCount}`);
    }

    assertNoErrors(errors, '/products');
    await ctx.close();
  });

  test('P6: 사용자 관리 목록 — 페이지네이션 정상', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();
    const errors = attachErrorWatcher(page);

    await page.goto(`${BASE}/users`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText).not.toContain("This page couldn't load");
    expect(bodyText.length).toBeGreaterThan(10);

    const tableVisible = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false);
    if (tableVisible) {
      const rowCount = await page.locator('table tbody tr').count();
      expect(rowCount).toBeLessThanOrEqual(100);
      console.log(`[Production] /users 테이블 행 수: ${rowCount}`);
    }

    assertNoErrors(errors, '/users');
    await ctx.close();
  });
});
