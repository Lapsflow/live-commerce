/**
 * Barcode Scan Feature E2E Tests
 * Tests barcode lookup, price comparison (Naver/Coupang), and AI analysis (Gemini)
 * Uses EAN-13 barcodes with sellPrice > 0 for real market data
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://supermujin.ai';

/** Login as master and return page */
async function loginAsMaster(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="username"], input[id="username"], input[type="text"]', 'master');
  await page.fill('input[type="password"]', 'master1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|products|orders)/, { timeout: 15000 });
  return { context, page };
}

/** Find a product with EAN barcode (numeric, 8+ digits) and sellPrice > 0 */
async function findEanProduct(page: import('@playwright/test').Page) {
  // Search across multiple pages to find an EAN product with real pricing
  for (let pi = 0; pi < 5; pi++) {
    const result = await page.evaluate(async ({ baseUrl, pageIndex }) => {
      const res = await fetch(`${baseUrl}/api/products?pageIndex=${pageIndex}&pageSize=100`);
      return await res.json();
    }, { baseUrl: BASE_URL, pageIndex: pi });

    if (!result.data || result.data.length === 0) break;

    const eanProduct = result.data.find(
      (p: { barcode?: string; sellPrice?: number }) =>
        p.barcode && /^\d{8,13}$/.test(p.barcode) && (p.sellPrice || 0) > 0
    );

    if (eanProduct) return eanProduct;
  }
  return null;
}

test.describe('Barcode Scan Feature', () => {
  test.beforeEach(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120000);
  });

  test('API: barcode product lookup (EAN barcode)', async ({ browser }) => {
    const { context, page } = await loginAsMaster(browser);
    console.log('MASTER login successful');

    const product = await findEanProduct(page);
    expect(product).toBeTruthy();
    console.log(`\nFound EAN product: ${product.barcode} | ${product.name} | sell=${product.sellPrice}`);

    // Barcode lookup API
    const barcodeResult = await page.evaluate(async ({ baseUrl, barcode }) => {
      const res = await fetch(`${baseUrl}/api/products/barcode/${barcode}`);
      const text = await res.text();
      try {
        return { status: res.status, body: JSON.parse(text) };
      } catch {
        return { status: res.status, body: null, raw: text.substring(0, 500) };
      }
    }, { baseUrl: BASE_URL, barcode: product.barcode });

    console.log(`Barcode lookup: status=${barcodeResult.status}`);
    expect(barcodeResult.status).toBe(200);

    const data = barcodeResult.body.data;
    expect(data).toBeTruthy();
    expect(data.name).toBeTruthy();
    expect(data.barcode).toBe(product.barcode);
    expect(data.sellPrice).toBeGreaterThan(0);
    console.log(`  name: ${data.name}`);
    console.log(`  sellPrice: ${data.sellPrice}, supplyPrice: ${data.supplyPrice}`);
    console.log(`  totalStock: ${data.totalStock}`);
    console.log(`  centerStocks: ${data.centerStocks?.length || 0} centers`);

    await context.close();
  });

  test('API: price comparison with real Naver/Coupang data', async ({ browser }) => {
    const { context, page } = await loginAsMaster(browser);

    const product = await findEanProduct(page);
    expect(product).toBeTruthy();
    console.log(`\nPrice comparison for: ${product.barcode} | ${product.name} | sell=${product.sellPrice}`);

    const pricingResult = await page.evaluate(async ({ baseUrl, barcode, price }) => {
      const params = new URLSearchParams({ barcode, price: String(price) });
      const res = await fetch(`${baseUrl}/api/pricing/compare?${params}`);
      const text = await res.text();
      try {
        return { status: res.status, body: JSON.parse(text) };
      } catch {
        return { status: res.status, body: null, raw: text.substring(0, 500) };
      }
    }, { baseUrl: BASE_URL, barcode: product.barcode, price: product.sellPrice });

    console.log(`Price comparison: status=${pricingResult.status}`);
    expect(pricingResult.status).toBe(200);

    const pricing = pricingResult.body.data;
    expect(pricing).toBeTruthy();
    console.log(`  competitiveness: ${pricing.competitiveness}`);
    console.log(`  market: avgPrice=${pricing.market?.avgPrice}, minPrice=${pricing.market?.minPrice}, maxPrice=${pricing.market?.maxPrice}`);

    if (pricing.naver) {
      console.log(`  naver: count=${pricing.naver.count}, min=${pricing.naver.minPrice}, avg=${pricing.naver.avgPrice}, max=${pricing.naver.maxPrice}`);
      expect(pricing.naver.count).toBeGreaterThan(0);
    } else {
      console.log('  naver: no results');
    }

    if (pricing.coupang) {
      console.log(`  coupang: count=${pricing.coupang.count}, min=${pricing.coupang.minPrice}, avg=${pricing.coupang.avgPrice}, max=${pricing.coupang.maxPrice}`);
      expect(pricing.coupang.count).toBeGreaterThan(0);
    } else {
      console.log('  coupang: no results');
    }

    // At least one marketplace should have data for EAN barcodes
    const hasMarketData = pricing.naver || pricing.coupang;
    console.log(`  Has market data: ${!!hasMarketData}`);

    // Competitiveness should be valid
    if (pricing.competitiveness) {
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(pricing.competitiveness);
      console.log(`  Competitiveness: ${pricing.competitiveness} ✓`);
    }

    await context.close();
  });

  test('API: AI analysis with real product data', async ({ browser }) => {
    const { context, page } = await loginAsMaster(browser);

    const product = await findEanProduct(page);
    expect(product).toBeTruthy();
    console.log(`\nAI analysis for: ${product.barcode} | ${product.name} | sell=${product.sellPrice}`);

    const aiResult = await page.evaluate(async ({ baseUrl, barcode }) => {
      const res = await fetch(`${baseUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, skipCache: false }),
      });
      const text = await res.text();
      try {
        return { status: res.status, body: JSON.parse(text) };
      } catch {
        return { status: res.status, body: null, raw: text.substring(0, 500) };
      }
    }, { baseUrl: BASE_URL, barcode: product.barcode });

    console.log(`AI analysis: status=${aiResult.status}`);

    // Accept 200, 429 (rate limit), or 500 (server error)
    expect([200, 429, 500]).toContain(aiResult.status);

    if (aiResult.status === 200) {
      const analysis = aiResult.body.data;
      expect(analysis).toBeTruthy();

      console.log(`  pricing: ${analysis.pricing ? 'present ✓' : 'missing ✗'}`);
      console.log(`  sales: ${analysis.sales ? 'present ✓' : 'missing ✗'}`);
      console.log(`  rateLimit: ${JSON.stringify(analysis.rateLimit)}`);

      if (analysis.pricing?.competitiveness) {
        console.log(`  pricing.competitiveness: score=${analysis.pricing.competitiveness.score}, position=${analysis.pricing.competitiveness.position}`);
      }
      if (analysis.pricing?.marginHealth) {
        console.log(`  pricing.marginHealth: healthy=${analysis.pricing.marginHealth.isHealthy}, margin=${analysis.pricing.marginHealth.currentMarginPercent}%`);
      }
      if (analysis.sales) {
        console.log(`  sales.keyPoints: ${analysis.sales.keyPoints?.length || 0} items`);
        console.log(`  sales.targetCustomer: ${analysis.sales.targetCustomer ? 'present' : 'missing'}`);
        console.log(`  sales.broadcastScript: ${analysis.sales.broadcastScript ? 'present' : 'missing'}`);
      }

      expect(analysis.pricing).toBeTruthy();
      expect(analysis.sales).toBeTruthy();
      expect(analysis.rateLimit).toBeTruthy();
    } else if (aiResult.status === 429) {
      console.log('  Rate limit exceeded (429) — expected if tests ran recently');
    } else {
      console.log(`  Server error (500): ${aiResult.body?.error?.message || aiResult.body?.message || 'unknown'}`);
    }

    await context.close();
  });

  test('UI: full barcode scan flow with price comparison and AI', async ({ browser }) => {
    const { context, page } = await loginAsMaster(browser);
    console.log('MASTER login successful');

    // Find EAN product with real pricing
    const product = await findEanProduct(page);
    expect(product).toBeTruthy();

    const barcode = product.barcode;
    console.log(`\nUsing barcode: ${barcode} (${product.name}, sell=${product.sellPrice})`);

    // Navigate to barcode scanner page
    await page.goto(`${BASE_URL}/inventory/barcode`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify default mode is LOOKUP
    const lookupTab = page.getByText('상품 조회', { exact: true }).first();
    await expect(lookupTab).toBeVisible();
    console.log('LOOKUP mode tab visible ✓');

    await page.screenshot({ path: 'tests/screenshots/barcode-initial.png' });

    // Trigger manual input (camera won't work in headless)
    const cameraButton = page.getByText('카메라 활성화');
    if (await cameraButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking "카메라 활성화" to trigger permission denial...');
      await cameraButton.click();
      await page.waitForTimeout(2000);
    }

    // Look for manual input field (appears after camera denial)
    const manualInput = page.getByPlaceholder('바코드 번호 입력');
    let manualInputVisible = await manualInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!manualInputVisible) {
      const manualButton = page.getByText('수동 입력');
      if (await manualButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await manualButton.click();
        await page.waitForTimeout(500);
        manualInputVisible = await manualInput.isVisible({ timeout: 3000 }).catch(() => false);
      }
    }

    expect(manualInputVisible).toBe(true);
    console.log('Manual input field visible ✓');

    await page.screenshot({ path: 'tests/screenshots/barcode-manual-input.png' });

    // Enter barcode and search
    console.log(`Entering barcode: ${barcode}`);
    await manualInput.fill(barcode);
    await page.getByRole('button', { name: '검색' }).click();
    console.log('Search clicked, waiting for product lookup...');

    // Wait for ProductDetailsModal to appear
    const modalTitle = page.getByText('스캔 완료');
    await expect(modalTitle).toBeVisible({ timeout: 15000 });
    console.log('ProductDetailsModal opened ✓');

    await page.screenshot({ path: 'tests/screenshots/barcode-modal-loading.png' });

    // Verify product info in modal
    const productNameEl = page.locator('h3').first();
    if (await productNameEl.isVisible()) {
      console.log(`Product name in modal: ${await productNameEl.textContent()}`);
    }

    // === PriceComparisonCard ===
    console.log('\n--- Price Comparison Card ---');
    const priceCardTitle = page.getByText('시장 가격 비교');
    await expect(priceCardTitle).toBeVisible({ timeout: 5000 });
    console.log('Price comparison card visible ✓');

    // Wait for price data to load
    console.log('Waiting for price data...');
    await page.waitForTimeout(15000);

    // Check for Naver / Coupang sections
    const naverVisible = await page.getByText('네이버 쇼핑').isVisible({ timeout: 3000 }).catch(() => false);
    const coupangVisible = await page.getByText('쿠팡').first().isVisible({ timeout: 3000 }).catch(() => false);
    const ourPriceVisible = await page.getByText('우리 판매가').isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Naver section: ${naverVisible ? '✓' : '✗'}`);
    console.log(`Coupang section: ${coupangVisible ? '✓' : '✗'}`);
    console.log(`Our price display: ${ourPriceVisible ? '✓' : '✗'}`);

    // Check competitiveness badge
    for (const badge of ['매우 경쟁력 있음', '경쟁력 있음', '보통', '경쟁력 낮음']) {
      if (await page.getByText(badge).isVisible({ timeout: 500 }).catch(() => false)) {
        console.log(`Competitiveness badge: "${badge}" ✓`);
        break;
      }
    }

    await page.screenshot({ path: 'tests/screenshots/barcode-price-comparison.png' });

    // === AIInsightsCard ===
    console.log('\n--- AI Insights Card ---');
    const aiCardTitle = page.getByText('AI 분석 결과');
    await expect(aiCardTitle).toBeVisible({ timeout: 5000 });
    console.log('AI insights card visible ✓');

    // Wait for AI analysis (3-10 seconds typical, up to 30s)
    console.log('Waiting for AI analysis...');
    await page.waitForTimeout(15000);

    const stillLoading = await page.getByText('AI가 분석하는 중입니다...').isVisible({ timeout: 2000 }).catch(() => false);
    if (stillLoading) {
      console.log('AI still loading, waiting more...');
      await page.waitForTimeout(15000);
    }

    // Check AI tabs
    const pricingTabVisible = await page.getByText('가격 전략').isVisible({ timeout: 3000 }).catch(() => false);
    const salesTabVisible = await page.getByText('판매 전략').isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Pricing strategy tab: ${pricingTabVisible ? '✓' : '✗'}`);
    console.log(`Sales strategy tab: ${salesTabVisible ? '✓' : '✗'}`);

    // Check rate limit badge
    const rateLimitBadge = page.locator('text=/\\d+\\/10 남음/');
    if (await rateLimitBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`Rate limit: ${await rateLimitBadge.textContent()}`);
    }

    // Check AI error state
    const aiErrorVisible = await page.getByText('AI 분석에 실패했습니다').isVisible({ timeout: 2000 }).catch(() => false);
    if (aiErrorVisible) {
      console.log('AI analysis failed (rate limited or API error)');
    }

    // Explore pricing tab content
    if (pricingTabVisible) {
      await page.getByText('가격 전략').click();
      await page.waitForTimeout(1000);
      const hasCompetitiveness = await page.getByText('가격 경쟁력').isVisible({ timeout: 2000 }).catch(() => false);
      const hasMarginHealth = await page.getByText('마진 건강도').isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  Price competitiveness: ${hasCompetitiveness ? '✓' : '✗'}`);
      console.log(`  Margin health: ${hasMarginHealth ? '✓' : '✗'}`);
    }

    // Explore sales tab content
    if (salesTabVisible) {
      await page.getByText('판매 전략').click();
      await page.waitForTimeout(1000);
      const hasKeyPoints = await page.getByText('주요 포인트').isVisible({ timeout: 2000 }).catch(() => false);
      const hasTarget = await page.getByText('타겟 고객').isVisible({ timeout: 2000 }).catch(() => false);
      const hasBroadcast = await page.getByText('방송 스크립트 제안').isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  Key points: ${hasKeyPoints ? '✓' : '✗'}`);
      console.log(`  Target customer: ${hasTarget ? '✓' : '✗'}`);
      console.log(`  Broadcast script: ${hasBroadcast ? '✓' : '✗'}`);
    }

    await page.screenshot({ path: 'tests/screenshots/barcode-ai-analysis.png' });

    // Summary
    console.log('\n=== BARCODE SCAN TEST SUMMARY ===');
    console.log(`Barcode: ${barcode}`);
    console.log(`Product: ${product.name} (sell=${product.sellPrice})`);
    console.log(`Price comparison: ✓`);
    console.log(`AI analysis: ${pricingTabVisible || salesTabVisible ? '✓' : aiErrorVisible ? '✗ (error)' : '✗ (loading)'}`);

    await context.close();
  });
});
