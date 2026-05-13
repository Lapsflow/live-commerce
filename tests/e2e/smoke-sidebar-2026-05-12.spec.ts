/**
 * Stage 1: Smoke Sidebar — 모든 권한 × 모든 사이드바 메뉴 진입 검증
 *
 * 목적: 사이드바에서 클릭 가능한 모든 페이지에 진입했을 때
 *       페이지가 죽지 않는지 (OOM, TypeError, 500 등) 전수 확인.
 *
 * 2026-05-12 /dashboard/onewms crash 같은 케이스를 자동으로 잡는다.
 */

import { test, expect, Browser } from '@playwright/test';
import { attachErrorWatcher, assertNoErrors } from './helpers/console-watcher';

const BASE = 'https://www.supermujin.ai';

/* ── 권한별 사이드바 메뉴 (sidebar.tsx 동기화 2026-05-12) ── */
const SIDEBAR_MENUS: Record<string, { label: string; href: string }[]> = {
  MASTER: [
    { label: '전체 통계', href: '/dashboard' },
    { label: '사용자 관리', href: '/users' },
    { label: '센터 관리', href: '/centers' },
    { label: '계약 승인', href: '/admin/contracts' },
    { label: '발주 관리', href: '/orders' },
    { label: '방송별 통합 발주서', href: '/orders/by-broadcast' },
    { label: '방송 관리', href: '/broadcasts' },
    { label: '방송 캘린더', href: '/broadcasts/calendar' },
    { label: '상품 관리', href: '/products' },
    { label: '엑셀 업로드', href: '/products/upload' },
    { label: '센터 상품 현황', href: '/admin/center-products' },
    { label: '상품 제안', href: '/proposals' },
    { label: '샘플 요청', href: '/samples/requests' },
    { label: '바코드', href: '/barcode' },
    { label: '변경 이력', href: '/admin/audit-log' },
    { label: '동기화 모니터', href: '/admin/sync-monitor' },
  ],
  SUB_MASTER: [
    { label: '대시보드', href: '/dashboard' },
    { label: '셀러 관리', href: '/users' },
    { label: '발주 컨펌', href: '/orders' },
    { label: '입금 관리', href: '/payments' },
    { label: '방송 관리', href: '/broadcasts' },
    { label: '방송 캘린더', href: '/broadcasts/calendar' },
    { label: '상품 관리', href: '/products' },
    { label: '바코드', href: '/barcode' },
  ],
  SELLER: [
    { label: '내 통계', href: '/dashboard' },
    { label: '방송 신청', href: '/broadcasts' },
    { label: '방송 캘린더', href: '/broadcasts/calendar' },
    { label: '내 발주', href: '/orders' },
    { label: '상품 제안', href: '/products' },
    { label: '샘플 요청', href: '/proposals' },
    { label: '바코드', href: '/barcode' },
  ],
};

/* ── 권한별 storageState 파일 (www.supermujin.ai 도메인 쿠키) ── */
const AUTH_FILES: Record<string, string> = {
  MASTER: 'playwright/.auth/supermujin.json',
  SUB_MASTER: 'playwright/.auth/supermujin-submaster.json',
  SELLER: 'playwright/.auth/supermujin-seller.json',
};

import * as fs from 'fs';

for (const [role, menus] of Object.entries(SIDEBAR_MENUS)) {
  test.describe(`[Smoke] ${role} 사이드바 전체 진입 (${menus.length}건)`, () => {
    const authFile = AUTH_FILES[role];

    test.beforeEach(async () => {
      if (!fs.existsSync(authFile)) {
        test.skip(true, `${role} 인증 파일 없음: ${authFile}`);
      }
    });

    for (const menu of menus) {
      test(`${role} → ${menu.label} (${menu.href})`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: authFile });
        const page = await ctx.newPage();
        const errors = attachErrorWatcher(page);

        // 직접 URL 진입 (사이드바 클릭 대신 — 클릭은 exploration spec에서 검증)
        await page.goto(`${BASE}${menu.href}`, { timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        // 1. 빈 화면이 아닌지
        const bodyText = (await page.locator('body').innerText()).trim();
        expect(bodyText.length).toBeGreaterThan(10);

        // 2. 에러 페이지 텍스트 가시 금지 (이번 /dashboard/onewms 버그 패턴)
        expect(bodyText).not.toContain("This page couldn't load");
        expect(bodyText).not.toContain('Application error');

        // 3. 콘솔/페이지/네트워크 에러 없음
        assertNoErrors(errors, `${role} → ${menu.label}`);

        await ctx.close();
      });
    }
  });
}
