const { chromium } = require('playwright');

async function captureScreens() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 800
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });

  try {
    // 로그인
    console.log('🔐 로그인 중...');
    await page.goto('https://script.google.com/macros/s/AKfycbyrpVxyabmqsBj1l6pQOLLfXAJXi_oztal3SKFngnZtL_Y0O7lGuHZDDM6FmUmBwWCk8A/exec');
    await page.waitForTimeout(3000);

    const frames = page.frames();
    let loginFrame = page;
    for (const frame of frames) {
      const inputs = await frame.locator('input').count();
      if (inputs > 0) {
        loginFrame = frame;
        break;
      }
    }

    const inputs = await loginFrame.locator('input').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('master');
      await inputs[1].fill('1234');
      const btn = await loginFrame.locator('button').first();
      await btn.click();
      await page.waitForTimeout(4000);
    }

    console.log('✅ 로그인 완료\n');

    // 메인 바코드 스캔 페이지
    console.log('📸 1. 바코드 스캔 메인');
    await page.screenshot({ path: '/tmp/01-barcode-scan-main.png', fullPage: true });
    await page.waitForTimeout(1000);

    // 발주 현황 탭 클릭 시도
    console.log('📸 2. 발주 현황 탭 클릭 시도...');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/02-order-status.png', fullPage: true });

    console.log('\n완료! 스크린샷:');
    console.log('  /tmp/01-barcode-scan-main.png');
    console.log('  /tmp/02-order-status.png');

    // 30초 대기 (수동 확인용)
    console.log('\n⏰ 30초 동안 수동으로 메뉴를 클릭해보세요...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await browser.close();
  }
}

captureScreens().catch(console.error);
