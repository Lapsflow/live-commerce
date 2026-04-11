const { chromium } = require('playwright');

async function checkBarcodeSystem() {
  console.log('🔍 바코드 시스템 점검 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // 1. Google Apps Script 페이지 접속
    console.log('📱 1. Google Apps Script 페이지 접속...');
    const url = 'https://script.google.com/macros/s/AKfycbyrpVxyabmqsBj1l6pQOLLfXAJXi_oztal3SKFngnZtL_Y0O7lGuHZDDM6FmUmBwWCk8A/exec';
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('   ✅ 페이지 로딩 완료\n');

    // 2. 로그인
    console.log('🔐 2. 로그인 시도...');

    // iframe 확인
    const frames = page.frames();
    console.log(`   프레임 수: ${frames.length}`);

    let loginFrame = page;

    // iframe이 있으면 해당 프레임에서 작업
    if (frames.length > 1) {
      for (const frame of frames) {
        const inputs = await frame.locator('input').count();
        if (inputs > 0) {
          loginFrame = frame;
          console.log('   ✓ 로그인 폼이 있는 iframe 발견');
          break;
        }
      }
    }

    // ID 입력 (placeholder로 찾기)
    const idInputs = await loginFrame.locator('input').all();
    console.log(`   입력 필드 발견: ${idInputs.length}개`);

    if (idInputs.length >= 2) {
      // 첫 번째는 ID, 두 번째는 PW로 가정
      await idInputs[0].fill('master');
      console.log('   ✓ ID 입력: master');

      await idInputs[1].fill('1234');
      console.log('   ✓ PW 입력: 1234');

      // 로그인 버튼 클릭
      const loginButton = await loginFrame.locator('button').first();
      await loginButton.click();
      await page.waitForTimeout(3000); // 로그인 처리 대기
      console.log('   ✅ 로그인 시도 완료\n');
    }

    // 로그인 후 스크린샷
    await page.screenshot({ path: '/tmp/barcode-main-page.png', fullPage: true });
    console.log('   📸 메인 페이지: /tmp/barcode-main-page.png\n');

    // 3. 바코드 페이지 찾기
    console.log('📦 3. 바코드 페이지 탐색...');

    // 바코드 관련 링크/버튼 찾기
    const barcodeLinks = await page.locator('a, button').filter({ hasText: /바코드|barcode/i }).all();

    if (barcodeLinks.length > 0) {
      console.log(`   찾은 바코드 링크: ${barcodeLinks.length}개`);

      for (let i = 0; i < barcodeLinks.length; i++) {
        const text = await barcodeLinks[i].textContent();
        console.log(`   ${i + 1}. ${text}`);
      }

      // 첫 번째 바코드 링크 클릭
      console.log(`\n   첫 번째 바코드 메뉴 클릭...`);
      await barcodeLinks[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // 4. 바코드 페이지 분석
    console.log('\n🔍 4. 바코드 페이지 기능 분석...');

    // 페이지 제목
    const pageTitle = await page.title();
    console.log(`   페이지 제목: ${pageTitle}`);

    // 모든 버튼 찾기
    const buttons = await page.locator('button').all();
    console.log(`\n   📋 발견된 버튼: ${buttons.length}개`);
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const text = await buttons[i].textContent();
      if (text && text.trim()) {
        console.log(`      - ${text.trim()}`);
      }
    }

    // 입력 필드 찾기
    const inputs = await page.locator('input').all();
    console.log(`\n   📝 발견된 입력 필드: ${inputs.length}개`);
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const name = await inputs[i].getAttribute('name');
      console.log(`      - type: ${type}, name: ${name}, placeholder: ${placeholder}`);
    }

    // 테이블 찾기
    const tables = await page.locator('table').all();
    console.log(`\n   📊 발견된 테이블: ${tables.length}개`);

    // 바코드 페이지 스크린샷
    await page.screenshot({ path: '/tmp/barcode-page-current.png', fullPage: true });
    console.log(`\n   📸 현재 바코드 페이지: /tmp/barcode-page-current.png`);

    // 5. 주요 메뉴 확인
    console.log('\n📋 5. 전체 메뉴 구조 확인...');
    const allLinks = await page.locator('a, button').all();
    const menuItems = new Set();

    for (const link of allLinks) {
      const text = await link.textContent();
      if (text && text.trim() && text.length < 30) {
        menuItems.add(text.trim());
      }
    }

    console.log('   주요 메뉴:');
    Array.from(menuItems).sort().forEach(item => {
      console.log(`      - ${item}`);
    });

    console.log('\n\n⚠️  문제점 분석 중...');
    console.log('   - API 연동 상태 확인 필요');
    console.log('   - 바코드 스캔 기능 구현 상태 확인 필요');
    console.log('   - 재고 데이터 API 연동 확인 필요');

    await page.waitForTimeout(5000); // 확인 시간

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    await page.screenshot({ path: '/tmp/barcode-error.png' });
    console.log('   📸 에러 스크린샷: /tmp/barcode-error.png');
  } finally {
    await browser.close();
  }
}

checkBarcodeSystem().catch(console.error);
