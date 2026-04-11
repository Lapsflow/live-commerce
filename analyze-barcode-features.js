const { chromium } = require('playwright');

async function analyzeBarcodeFeatures() {
  console.log('🔍 바코드 시스템 기능 분석 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // 로그인
    console.log('🔐 로그인...');
    const url = 'https://script.google.com/macros/s/AKfycbyrpVxyabmqsBj1l6pQOLLfXAJXi_oztal3SKFngnZtL_Y0O7lGuHZDDM6FmUmBwWCk8A/exec';
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const frames = page.frames();
    let loginFrame = page;
    for (const frame of frames) {
      const inputs = await frame.locator('input').count();
      if (inputs > 0) {
        loginFrame = frame;
        break;
      }
    }

    const idInputs = await loginFrame.locator('input').all();
    if (idInputs.length >= 2) {
      await idInputs[0].fill('master');
      await idInputs[1].fill('1234');
      const loginButton = await loginFrame.locator('button').first();
      await loginButton.click();
      await page.waitForTimeout(3000);
    }
    console.log('✅ 로그인 완료\n');

    // iframe 찾기
    let appFrame = page;
    for (const frame of page.frames()) {
      const title = await frame.title();
      const buttons = await frame.locator('button').count();
      if (buttons > 5) {
        appFrame = frame;
        console.log('   앱 프레임 발견\n');
        break;
      }
    }

    // 좌측 사이드바 메뉴들 확인
    console.log('📋 좌측 사이드바 메뉴 분석...\n');

    const sidebarMenus = [
      '바코드툴 스캔 카메라',
      '전체 제고',
      '판매기',
      '공급가',
      '아이템'
    ];

    for (const menuName of sidebarMenus) {
      console.log(`\n🔍 [${menuName}] 메뉴 클릭...`);

      try {
        // 메뉴 클릭
        const menuButton = page.locator(`text=${menuName}`).first();
        if (await menuButton.isVisible()) {
          await menuButton.click();
          await page.waitForTimeout(2000);

          // 스크린샷
          await page.screenshot({
            path: `/tmp/barcode-menu-${menuName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });

          // 페이지 내용 분석
          const buttons = await page.locator('button').all();
          const inputs = await page.locator('input').all();
          const tables = await page.locator('table').all();

          console.log(`   버튼: ${buttons.length}개`);
          console.log(`   입력필드: ${inputs.length}개`);
          console.log(`   테이블: ${tables.length}개`);

          // 에러 메시지 확인
          const errorMessages = await page.locator('text=/오류|에러|error|구현|준비/i').all();
          if (errorMessages.length > 0) {
            console.log(`   ⚠️  경고/에러 메시지 ${errorMessages.length}개 발견`);
            for (const msg of errorMessages.slice(0, 3)) {
              const text = await msg.textContent();
              console.log(`      - ${text}`);
            }
          }

          // API 관련 텍스트 확인
          const apiText = await page.locator('text=/API|api|연동|동기화/i').all();
          if (apiText.length > 0) {
            console.log(`   📡 API 관련 텍스트: ${apiText.length}개`);
          }
        }
      } catch (e) {
        console.log(`   ❌ 에러: ${e.message}`);
      }
    }

    // 상단 탭 메뉴 확인
    console.log('\n\n📋 상단 탭 메뉴 분석...\n');

    const topMenus = [
      '발주 현황',
      '판매현황',
      '내 셀러',
      '전체 관리',
      '방송일정'
    ];

    for (const menuName of topMenus) {
      console.log(`\n🔍 [${menuName}] 탭 클릭...`);

      try {
        const tabButton = page.locator(`text=${menuName}`).first();
        if (await tabButton.isVisible()) {
          await tabButton.click();
          await page.waitForTimeout(2000);

          await page.screenshot({
            path: `/tmp/barcode-tab-${menuName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });

          const buttons = await page.locator('button').count();
          const inputs = await page.locator('input').count();
          const tables = await page.locator('table').count();

          console.log(`   버튼: ${buttons}개, 입력: ${inputs}개, 테이블: ${tables}개`);

          // 주요 텍스트 확인
          const bodyText = await page.locator('body').textContent();
          if (bodyText.includes('준비중') || bodyText.includes('구현') || bodyText.includes('개발')) {
            console.log(`   ⚠️  "준비중/구현/개발" 관련 텍스트 발견`);
          }
        }
      } catch (e) {
        console.log(`   ❌ 에러: ${e.message}`);
      }
    }

    console.log('\n\n✅ 분석 완료! 스크린샷들을 확인하세요.');
    console.log('\n생성된 스크린샷:');
    console.log('  /tmp/barcode-menu-*.png');
    console.log('  /tmp/barcode-tab-*.png');

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await browser.close();
  }
}

analyzeBarcodeFeatures().catch(console.error);
