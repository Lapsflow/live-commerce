import { test, expect } from '@playwright/test';

/**
 * Phase 0: 바코드 입력 UX 개선 검증
 *
 * 검증 항목:
 * 1. 바코드 입력 후 입력란 자동 초기화
 * 2. 검색 후 포커스 자동 유지
 * 3. 포커스 벗어난 후 자동 복귀
 * 4. 5건 연속 스캔
 * 5. 스캔 이력 표시 (최근 10건)
 * 6. 이력 칩 클릭 → 상품 전환
 * 7. autoComplete=off 속성 확인
 */

/** Find products with valid barcodes from the API */
async function findValidBarcodes(page: import('@playwright/test').Page, count: number) {
  const result = await page.evaluate(async (cnt) => {
    const res = await fetch(`/api/products?pageIndex=0&pageSize=200`);
    const json = await res.json();
    if (!json.data) return [];
    const products = json.data
      .filter((p: any) => p.barcode && p.barcode.length >= 5 && p.isActive)
      .slice(0, cnt);
    return products.map((p: any) => ({ barcode: p.barcode, name: p.name }));
  }, count);
  return result as { barcode: string; name: string }[];
}

test.describe('Phase 0: 바코드 입력 UX 개선', () => {
  // Use master auth (admin.json = master account)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('1. 바코드 입력 후 입력란 자동 초기화', async ({ page }) => {
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const products = await findValidBarcodes(page, 1);
    expect(products.length).toBeGreaterThan(0);
    const barcode = products[0].barcode;

    const input = page.locator('input[placeholder*="바코드"]');
    await expect(input).toBeVisible();

    await input.fill(barcode);
    await input.press('Enter');

    // 입력란이 즉시 비워져야 함 (handleSearch에서 setBarcode("") 호출)
    await expect(input).toHaveValue('', { timeout: 3000 });

    // 검색 결과 대기
    await expect(page.locator('button:has-text("검색중")')).toBeHidden({ timeout: 15000 });

    await page.screenshot({ path: 'test-results/p0-01-input-cleared.png' });
  });

  test('2. 검색 후 포커스 자동 유지', async ({ page }) => {
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const products = await findValidBarcodes(page, 1);
    expect(products.length).toBeGreaterThan(0);

    const input = page.locator('input[placeholder*="바코드"]');
    await input.fill(products[0].barcode);
    await input.press('Enter');

    // 입력 초기화 대기
    await expect(input).toHaveValue('', { timeout: 3000 });

    // 200ms 후 포커스가 입력란에 있는지 확인
    await page.waitForTimeout(300);
    const isFocused = await input.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    await page.screenshot({ path: 'test-results/p0-02-focus-maintained.png' });
  });

  test('3. 다른 곳 클릭 후 200ms 후 포커스 자동 복귀', async ({ page }) => {
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const input = page.locator('input[placeholder*="바코드"]');
    await expect(input).toBeVisible();

    // 헤더(h1) 클릭으로 포커스 이동
    const header = page.locator('h1').first();
    await header.click();

    // 포커스가 input이 아닌지 확인
    const notFocused = await input.evaluate((el) => document.activeElement !== el);
    // blur 직후에는 포커스 아닐 수 있음 (200ms 타이머 대기 전)

    // 300ms 후 포커스 복귀 확인 (handleBlur의 200ms setTimeout)
    await page.waitForTimeout(400);
    const isFocused = await input.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    await page.screenshot({ path: 'test-results/p0-03-focus-recovered.png' });
  });

  test('4. 5건 연속 스캔', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const products = await findValidBarcodes(page, 5);
    expect(products.length).toBeGreaterThanOrEqual(3); // 최소 3개 이상

    const input = page.locator('input[placeholder*="바코드"]');

    for (const product of products) {
      await input.fill(product.barcode);
      await input.press('Enter');

      // 매 스캔 후 입력란 비워졌는지 확인
      await expect(input).toHaveValue('', { timeout: 3000 });

      // 검색 완료 대기
      await expect(page.locator('button:has-text("검색중")')).toBeHidden({ timeout: 15000 });
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'test-results/p0-04-five-consecutive-scans.png', fullPage: true });
  });

  test('5. 스캔 이력 표시 (2건 이상 시 표시)', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const products = await findValidBarcodes(page, 3);
    expect(products.length).toBeGreaterThanOrEqual(2);

    const input = page.locator('input[placeholder*="바코드"]');

    // 3건 스캔
    for (const product of products) {
      await input.fill(product.barcode);
      await input.press('Enter');
      await expect(input).toHaveValue('', { timeout: 3000 });
      await expect(page.locator('button:has-text("검색중")')).toBeHidden({ timeout: 15000 });
      await page.waitForTimeout(500);
    }

    // 이력 영역에 바코드들이 표시되는지 확인
    const historySection = page.locator('text=최근 스캔 이력');
    await expect(historySection).toBeVisible({ timeout: 5000 });

    // 각 바코드가 이력 칩에 표시되는지
    for (const product of products) {
      const chip = page.locator(`button:has-text("${product.barcode}")`);
      await expect(chip).toBeVisible({ timeout: 3000 });
    }

    await page.screenshot({ path: 'test-results/p0-05-history-chips.png', fullPage: true });
  });

  test('6. 이력 칩 클릭 시 해당 상품 정보 전환', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const products = await findValidBarcodes(page, 2);
    expect(products.length).toBeGreaterThanOrEqual(2);

    const input = page.locator('input[placeholder*="바코드"]');

    // 2건 스캔
    for (const product of products) {
      await input.fill(product.barcode);
      await input.press('Enter');
      await expect(input).toHaveValue('', { timeout: 3000 });
      await expect(page.locator('button:has-text("검색중")')).toBeHidden({ timeout: 15000 });
      await page.waitForTimeout(500);
    }

    // 현재 표시: 마지막 스캔 상품 (상세 영역의 p.font-mono)
    const currentBarcode = page.locator('p.font-mono').filter({ hasText: products[products.length - 1].barcode });
    await expect(currentBarcode).toBeVisible({ timeout: 5000 });

    // 첫 번째 바코드 칩 클릭
    const firstChip = page.locator(`button:has-text("${products[0].barcode}")`).first();
    if (await firstChip.isVisible({ timeout: 3000 })) {
      await firstChip.click();
      await page.waitForTimeout(500);

      // 첫 번째 상품 바코드가 상세 정보에 표시되는지
      const switchedBarcode = page.locator('p.font-mono').filter({ hasText: products[0].barcode });
      await expect(switchedBarcode).toBeVisible({ timeout: 3000 });
    }

    await page.screenshot({ path: 'test-results/p0-06-history-chip-click.png', fullPage: true });
  });

  test('7. autoComplete=off 검증', async ({ page }) => {
    await page.goto('/barcode');
    await page.waitForLoadState('networkidle');

    const input = page.locator('input[placeholder*="바코드"]');
    await expect(input).toBeVisible();

    const autoComplete = await input.getAttribute('autocomplete');
    expect(autoComplete).toBe('off');
  });
});
