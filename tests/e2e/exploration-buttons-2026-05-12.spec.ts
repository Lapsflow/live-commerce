/**
 * Stage 2: Exploration Buttons — 핵심 페이지 내 모든 클릭 가능 요소 자동 탐색
 *
 * 목적: 각 페이지에 진입한 후 main 영역의 버튼/링크를 자동 발견 + 클릭 →
 *       다음 화면이 죽는지 확인. "전체 보기" 같은 숨겨진 네비게이션을 잡는다.
 *
 * ⚠️ 운영 데이터 보호: 삭제/비활성화/초기화/로그아웃 등 위험 액션은 자동 스킵.
 */

import { test, expect } from '@playwright/test';
import { attachErrorWatcher, assertNoErrors } from './helpers/console-watcher';

const BASE = 'https://www.supermujin.ai';
const AUTH = 'playwright/.auth/supermujin.json'; // MASTER

/* ── MASTER 기준 핵심 페이지 목록 ── */
const PAGES_TO_EXPLORE = [
  '/dashboard',
  '/products',
  '/orders',
  '/orders/by-broadcast',
  '/broadcasts',
  '/users',
  '/centers',
  '/proposals',
  '/admin/sync-monitor',
];

/* ── 클릭 금지 텍스트 (운영 데이터 보호) ── */
const DANGEROUS_TEXT = /삭제|비활성화|초기화|로그아웃|취소|확인|제거|리셋|탈퇴|발송|변경/;

/* ── 클릭 금지 href (네비게이션 벗어남 방지) ── */
const SKIP_HREF = /logout|signout|delete|remove|api\//;

/* ── 페이지당 최대 탐색 요소 수 (대형 테이블 페이지 타임아웃 방지) ── */
const MAX_ELEMENTS_PER_PAGE = 20;

for (const pageUrl of PAGES_TO_EXPLORE) {
  test(`[Exploration] MASTER ${pageUrl} 의 모든 버튼/링크 클릭`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH });
    const page = await ctx.newPage();
    const errors = attachErrorWatcher(page);

    await page.goto(`${BASE}${pageUrl}`, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // main 영역 내 보이는 버튼/링크 수집
    const elements = await page.locator(
      'main a:visible, main button:visible'
    ).all();

    // main이 없으면 body에서 사이드바 제외하고 수집
    const interactiveElements = elements.length > 0
      ? elements
      : await page.locator(
          'a:visible:not(nav a):not(aside a), button:visible:not(nav button):not(aside button)'
        ).all();

    let clickCount = 0;
    let skipCount = 0;

    // 대형 페이지에서 타임아웃 방지: 최대 N개만 탐색
    const elementsToExplore = interactiveElements.slice(0, MAX_ELEMENTS_PER_PAGE);

    for (const el of elementsToExplore) {
      try {
        const isDisabled = await el.isDisabled().catch(() => true);
        if (isDisabled) { skipCount++; continue; }

        const href = await el.getAttribute('href').catch(() => null);
        const target = await el.getAttribute('target').catch(() => null);
        const type = await el.getAttribute('type').catch(() => null);
        const text = (await el.innerText().catch(() => '')).trim();

        // 외부 링크, submit, 새 탭, mailto 스킵
        if (target === '_blank') { skipCount++; continue; }
        if (href && (href.startsWith('http') || href.startsWith('mailto:'))) { skipCount++; continue; }
        if (type === 'submit') { skipCount++; continue; }
        if (href && SKIP_HREF.test(href)) { skipCount++; continue; }

        // 위험한 버튼 텍스트 스킵 (운영 데이터 보호)
        if (DANGEROUS_TEXT.test(text)) { skipCount++; continue; }

        // dialog 자동 dismiss
        page.once('dialog', (d) => d.dismiss().catch(() => {}));

        // 클릭 시도
        await el.click({ timeout: 5000 }).catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        clickCount++;

        // 페이지 crash 확인
        const bodyText = (await page.locator('body').innerText().catch(() => '')).trim();
        if (
          bodyText.includes("This page couldn't load") ||
          bodyText.includes('Application error') ||
          bodyText.includes('500 Internal Server Error')
        ) {
          throw new Error(
            `[Exploration] ${pageUrl} 에서 "${text || href}" 클릭 시 페이지 crash 발견`
          );
        }

        // 원래 페이지로 복귀 (다른 페이지로 이동한 경우)
        const currentPath = new URL(page.url()).pathname;
        if (currentPath !== pageUrl) {
          await page.goto(`${BASE}${pageUrl}`, { timeout: 30000 });
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        }
      } catch (err) {
        // 개별 요소 클릭 실패는 무시하되, crash 발견 시 re-throw
        if (err instanceof Error && err.message.includes('crash')) {
          throw err;
        }
      }
    }

    const totalElements = interactiveElements.length;
    const explored = elementsToExplore.length;
    console.log(`[Exploration] ${pageUrl}: ${clickCount}개 클릭 / ${skipCount}개 스킵 (${explored}/${totalElements} 탐색)`);

    // 전체 과정에서 콘솔/페이지 에러가 없었는지
    assertNoErrors(errors, `Exploration ${pageUrl}`);

    await ctx.close();
  });
}
