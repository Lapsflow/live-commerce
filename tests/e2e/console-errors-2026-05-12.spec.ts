/**
 * Stage 3: Console Errors — 핵심 페이지 콘솔/네트워크 에러 탐지
 *
 * 목적: MASTER가 핵심 페이지에 진입했을 때
 *       콘솔 에러, 페이지 에러, 5xx 응답이 없는지 빠르게 확인.
 *
 * 이번 /dashboard/onewms crash의 핵심 지표:
 *   - TypeError: conflicts.map is not a function → pageError 캡처
 *   - OOM → "This page couldn't load" 텍스트 캡처
 */

import { test, expect } from '@playwright/test';
import { attachErrorWatcher, assertNoErrors } from './helpers/console-watcher';

const BASE = 'https://www.supermujin.ai';
const AUTH = 'playwright/.auth/supermujin.json';

/* ── 핵심 페이지 목록 (사이드바 + 서브페이지) ── */
const CRITICAL_PAGES = [
  '/dashboard',
  '/dashboard/onewms', // ★ 이번 버그 회귀 방지
  '/products',
  '/orders',
  '/orders/by-broadcast',
  '/users',
  '/proposals',
  '/centers',
  '/broadcasts',
  '/admin/sync-monitor',
  '/admin/audit-log',
  '/admin/center-products',
  '/samples/requests',
  '/barcode',
];

test.describe('[Console] MASTER 핵심 페이지 콘솔 에러 점검', () => {
  for (const url of CRITICAL_PAGES) {
    test(`${url} — 콘솔/페이지/5xx 에러 없음`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: AUTH });
      const page = await ctx.newPage();
      const errors = attachErrorWatcher(page);

      await page.goto(`${BASE}${url}`, { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

      // refetchInterval 같은 비동기 요청도 캐치하기 위해 잠시 대기
      await page.waitForTimeout(3000);

      // 1. 페이지가 로드되었는지 (빈 화면 방지)
      const bodyText = (await page.locator('body').innerText()).trim();
      expect(bodyText.length).toBeGreaterThan(10);

      // 2. 에러 페이지 텍스트 체크
      expect(bodyText).not.toContain("This page couldn't load");
      expect(bodyText).not.toContain('Application error');

      // 3. 콘솔/페이지/5xx 에러 없음
      assertNoErrors(errors, url);

      await ctx.close();
    });
  }
});
