import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';
import { navigateToOrderDetail } from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Order Detail Page - Admin', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  // Helper: find an order that ADMIN can actually access via detail API
  async function findAccessibleOrder(): Promise<string | null> {
    const { data } = await api.getOrders({ pageSize: 20 });
    if (!data?.data?.length) return null;
    for (const order of data.data) {
      const { response } = await api.getOrder(order.id);
      if (response.ok()) return order.id;
    }
    return null;
  }

  // ─── 페이지 레이아웃 ──────────────────────────
  test.describe('페이지 레이아웃', () => {
    test('"발주 상세" 제목 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByRole('heading', { name: '발주 상세' })).toBeVisible();
    });

    test('"목록" 뒤로가기 버튼 표시 및 동작', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      const backBtn = page.getByRole('button', { name: /목록/ });
      await expect(backBtn).toBeVisible();
      await backBtn.click();
      await page.waitForURL(/\/orders$/);
    });
  });

  // ─── 발주 정보 카드 ───────────────────────────
  test.describe('발주 정보 카드', () => {
    test('"발주 정보" 섹션 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('발주 정보')).toBeVisible();
    });

    test('발주 번호 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('발주 번호')).toBeVisible();
    });

    test('셀러 이름 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('셀러', { exact: true })).toBeVisible();
    });

    test('상태 라벨 올바름 (대기/승인/거절)', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('상태').first()).toBeVisible();
      const statusBadge = page.locator('span').filter({ hasText: /^(대기|승인|거절)$/ });
      await expect(statusBadge.first()).toBeVisible();
    });

    test('입금 상태 표시 (입금확인전/입금완료)', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('입금 상태')).toBeVisible();
      const paymentBadge = page.locator('span').filter({ hasText: /^(입금확인전|입금완료)$/ });
      await expect(paymentBadge.first()).toBeVisible();
    });

    test('출고 상태 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('출고 상태')).toBeVisible();
    });

    test('등록일 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('등록일')).toBeVisible();
    });
  });

  // ─── 발주 항목 테이블 ─────────────────────────
  test.describe('발주 항목 테이블', () => {
    test('"발주 항목" 섹션 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('발주 항목')).toBeVisible();
    });

    test('테이블 헤더: 바코드, 상품명, 수량, 공급가, 마진', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      const headers = ['바코드', '상품명', '수량', '공급가', '마진'];
      for (const h of headers) {
        await expect(page.locator('th').filter({ hasText: h }).first()).toBeVisible();
      }
    });

    test('합계 행 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.locator('tfoot').getByText('합계')).toBeVisible();
    });

    test('금액에 "원" 포함', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      const amountCells = page.locator('tfoot td').filter({ hasText: /원/ });
      expect(await amountCells.count()).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── ONEWMS 정보 ──────────────────────────────
  test.describe('ONEWMS 정보', () => {
    test('ONEWMS 정보 섹션 표시', async ({ page }) => {
      const orderId = await findAccessibleOrder();
      test.skip(!orderId, 'No accessible orders for this admin');
      await navigateToOrderDetail(page, orderId!);
      await expect(page.getByText('ONEWMS 정보')).toBeVisible({ timeout: 10000 });
    });
  });

  // ─── 만료 카운트다운 배너 ─────────────────────
  test.describe('만료 카운트다운 배너', () => {
    test('PENDING+UNPAID 주문에 노란색 만료 배너 표시', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING+UNPAID order available');

      // Verify admin can access this order
      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this PENDING+UNPAID order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByText('입금 마감까지 남은 시간:')).toBeVisible();
      await expect(page.getByText('미입금 시 자동 취소됩니다')).toBeVisible();
    });

    test('APPROVED 주문에는 만료 배너 미표시', async ({ page }) => {
      const order = await api.findApprovedPaidOrder();
      test.skip(!order, 'No APPROVED order available');

      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this APPROVED order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByText('입금 마감까지 남은 시간:')).not.toBeVisible();
    });
  });

  // ─── 취소 사유 배너 ───────────────────────────
  test.describe('취소 사유 배너', () => {
    test('REJECTED 주문에 빨간색 취소 사유 배너 표시', async ({ page }) => {
      const order = await api.findRejectedOrder();
      test.skip(!order, 'No REJECTED order available');

      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this REJECTED order');

      await navigateToOrderDetail(page, order.id);
      // Cancel reason can be displayed in various formats
      const cancelBanner = page.locator('[class*="red"], [class*="destructive"]').filter({
        hasText: /취소|만료|경과/,
      });
      const textBanner = page.getByText('3시간 경과 자동 취소')
        .or(page.getByText('셀러 취소'))
        .or(page.getByText('관리자 취소'))
        .or(page.getByText('자동 취소'))
        .or(page.getByText('취소됨'));
      const combined = cancelBanner.or(textBanner);
      await expect(combined.first()).toBeVisible({ timeout: 10000 });
    });

    test('PENDING 주문에는 취소 사유 배너 미표시', async ({ page }) => {
      const order = await api.findPendingUnpaidOrder();
      test.skip(!order, 'No PENDING order available');

      const { response } = await api.getOrder(order.id);
      test.skip(!response.ok(), 'Admin cannot access this PENDING order');

      await navigateToOrderDetail(page, order.id);
      await expect(page.getByText('3시간 경과 자동 취소')).not.toBeVisible();
      await expect(page.getByText('셀러 취소')).not.toBeVisible();
      await expect(page.getByText('관리자 취소')).not.toBeVisible();
    });
  });
});
