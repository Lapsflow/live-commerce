import { test, expect } from '@playwright/test';
import { OrderApiHelper } from './helpers/order-api-helpers';
import { navigateToOrderDetail } from './helpers/order-ui-helpers';

test.use({ storageState: 'playwright/.auth/seller.json' });

test.describe('Order Detail Page - Seller', () => {
  let api: OrderApiHelper;

  test.beforeEach(async ({ request }) => {
    api = new OrderApiHelper(request);
  });

  // Helper: find an order the seller can access via detail API
  async function findAccessibleSellerOrder(): Promise<string | null> {
    const { data } = await api.getOrders({ pageSize: 20 });
    if (!data?.data?.length) return null;
    for (const order of data.data) {
      const { response } = await api.getOrder(order.id);
      if (response.ok()) return order.id;
    }
    return null;
  }

  test('본인 주문 상세 조회 가능', async ({ page }) => {
    const orderId = await findAccessibleSellerOrder();
    test.skip(!orderId, 'No accessible orders for seller');

    await navigateToOrderDetail(page, orderId!);
    await expect(page.getByRole('heading', { name: '발주 상세' })).toBeVisible();
    await expect(page.getByText('발주 정보')).toBeVisible();
  });

  test('입금확인 버튼이 표시되지 않음', async ({ page }) => {
    const order = await api.findPendingUnpaidOrder();
    test.skip(!order, 'No PENDING+UNPAID order available for seller');

    // Verify seller can access this specific order
    const { response } = await api.getOrder(order.id);
    test.skip(!response.ok(), 'Seller cannot access this order detail');

    await navigateToOrderDetail(page, order.id);
    await page.waitForTimeout(2000);
    const confirmBtn = page.getByRole('button', { name: /입금확인/ });
    expect(await confirmBtn.count()).toBe(0);
  });

  test('PENDING+UNPAID 주문에 취소 버튼 표시', async ({ page }) => {
    const order = await api.findPendingUnpaidOrder();
    test.skip(!order, 'No PENDING+UNPAID order available for seller');

    const { response } = await api.getOrder(order.id);
    test.skip(!response.ok(), 'Seller cannot access this order detail');

    await navigateToOrderDetail(page, order.id);
    await expect(page.getByRole('button', { name: /취소/ })).toBeVisible();
  });
});
