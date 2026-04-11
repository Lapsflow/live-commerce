/**
 * ONEWMS UI Test Script
 * Manual visual testing checklist
 */

const { chromium } = require('playwright');

async function testOnewmsUI() {
  console.log('🚀 ONEWMS UI 테스트 시작...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 1. 메인 대시보드 테스트
    console.log('📊 1. 메인 대시보드 테스트');
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');

    // ONEWMS 위젯 확인
    const onewmsWidget = await page.locator('text=ONEWMS 연동 상태').isVisible();
    console.log(`   ✓ ONEWMS 위젯 표시: ${onewmsWidget ? '✅' : '❌'}`);

    // 실패 주문 카드 확인
    const failedOrders = await page.locator('text=실패 주문').isVisible();
    console.log(`   ✓ 실패 주문 카드: ${failedOrders ? '✅' : '❌'}`);

    // 재고 충돌 카드 확인
    const stockConflicts = await page.locator('text=재고 충돌').isVisible();
    console.log(`   ✓ 재고 충돌 카드: ${stockConflicts ? '✅' : '❌'}`);

    // 전체 보기 버튼 확인
    const viewAllButton = await page.locator('text=전체 보기').isVisible();
    console.log(`   ✓ 전체 보기 버튼: ${viewAllButton ? '✅' : '❌'}`);

    await page.screenshot({ path: '/tmp/dashboard-main.png', fullPage: true });
    console.log('   📸 스크린샷 저장: /tmp/dashboard-main.png\n');

    // 2. ONEWMS 전용 대시보드 테스트
    console.log('📦 2. ONEWMS 전용 대시보드 테스트');
    await page.goto('http://localhost:3001/dashboard/onewms');
    await page.waitForLoadState('networkidle');

    // 상태 위젯 확인
    const statusWidget = await page.locator('text=총 동기화 주문').isVisible();
    console.log(`   ✓ 상태 위젯: ${statusWidget ? '✅' : '❌'}`);

    // 동기화 컨트롤 확인
    const syncControls = await page.locator('text=수동 동기화').isVisible();
    console.log(`   ✓ 동기화 컨트롤: ${syncControls ? '✅' : '❌'}`);

    await page.screenshot({ path: '/tmp/dashboard-onewms.png', fullPage: true });
    console.log('   📸 스크린샷 저장: /tmp/dashboard-onewms.png\n');

    // 3. 주문 목록 테스트
    console.log('📋 3. 주문 목록 테스트');
    await page.goto('http://localhost:3001/orders');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/orders-list.png', fullPage: true });
    console.log('   📸 스크린샷 저장: /tmp/orders-list.png\n');

    console.log('✅ 모든 테스트 완료!');
    console.log('\n📸 생성된 스크린샷:');
    console.log('   - /tmp/dashboard-main.png');
    console.log('   - /tmp/dashboard-onewms.png');
    console.log('   - /tmp/orders-list.png');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  } finally {
    await browser.close();
  }
}

testOnewmsUI().catch(console.error);
