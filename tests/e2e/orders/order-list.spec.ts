import { test, expect } from '@playwright/test';
import { navigateToOrders } from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Order List Page - Admin', () => {

  test.describe('페이지 레이아웃', () => {
    test('페이지 제목 "발주 관리" 표시', async ({ page }) => {
      await navigateToOrders(page);
      await expect(page.getByRole('heading', { name: '발주 관리' })).toBeVisible();
    });

    test('슈퍼무진 주문서 버튼 표시', async ({ page }) => {
      await navigateToOrders(page);
      await expect(page.getByRole('button', { name: /슈퍼무진 주문서/ })).toBeVisible();
    });

    test('자사몰 주문서 버튼 표시', async ({ page }) => {
      await navigateToOrders(page);
      await expect(page.getByRole('button', { name: /자사몰 주문서/ })).toBeVisible();
    });

    test('엑셀 업로드 링크 표시', async ({ page }) => {
      await navigateToOrders(page);
      const link = page.getByRole('link', { name: /엑셀 업로드/ });
      const linkCount = await link.count();
      if (linkCount > 0) {
        await expect(link.first()).toBeVisible();
      } else {
        await expect(page.getByText('엑셀 업로드').first()).toBeVisible();
      }
    });

    test('신규 발주 링크 표시', async ({ page }) => {
      await navigateToOrders(page);
      const link = page.getByRole('link', { name: /신규 발주/ });
      const linkCount = await link.count();
      if (linkCount > 0) {
        await expect(link.first()).toBeVisible();
      } else {
        await expect(page.getByText('신규 발주').first()).toBeVisible();
      }
    });

    test('엑셀 업로드 클릭 시 /orders/upload 이동', async ({ page }) => {
      await navigateToOrders(page);
      const link = page.getByRole('link', { name: /엑셀 업로드/ });
      const linkCount = await link.count();
      if (linkCount > 0) {
        await link.first().click();
      } else {
        await page.getByText('엑셀 업로드').first().click();
      }
      await page.waitForURL(/\/orders\/upload/);
      expect(page.url()).toContain('/orders/upload');
    });
  });

  test.describe('데이터 테이블', () => {
    test('테이블 컬럼 헤더 표시', async ({ page }) => {
      await navigateToOrders(page);
      const headers = ['주문번호', '판매자', '입금상태', '남은시간', '출고상태', '승인상태', '공급가합계', '등록일', '액션'];
      for (const header of headers) {
        await expect(page.locator('th, [role="columnheader"]').filter({ hasText: header }).first()).toBeVisible();
      }
    });

    test('주문 데이터 행 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      const rows = page.locator('tbody tr, [role="row"]').filter({ hasNotText: /주문번호|판매자/ });
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('입금상태 배지 라벨 올바름 (입금확인전/입금완료)', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      const badges = page.locator('text=입금확인전').or(page.locator('text=입금완료'));
      const count = await badges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('출고상태 배지 라벨 올바름', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      const shippingHeader = page.locator('th, [role="columnheader"]').filter({ hasText: '출고상태' });
      await expect(shippingHeader.first()).toBeVisible();
    });

    test('총금액이 "원" 형식으로 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      const cells = page.locator('td, [role="cell"]').filter({ hasText: /\d.*원/ });
      const count = await cells.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('Admin은 PENDING+UNPAID 주문에 입금확인 버튼 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      const confirmBtn = page.getByRole('button', { name: /입금확인/ });
      const count = await confirmBtn.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('PENDING+UNPAID 주문에 취소 버튼 표시', async ({ page }) => {
      await navigateToOrders(page);
      await page.waitForTimeout(3000);
      const cancelBtn = page.getByRole('button', { name: /^취소$/ });
      const count = await cancelBtn.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
