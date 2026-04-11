const { chromium } = require('playwright');

async function exploreLogin() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('로그인 페이지 탐색 중...');
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(3000);

    // 스크린샷
    await page.screenshot({ path: '/tmp/login-explore.png', fullPage: true });
    console.log('스크린샷 저장: /tmp/login-explore.png');

    // 모든 input 요소 찾기
    const inputs = await page.locator('input').all();
    console.log(`\n발견된 input 필드: ${inputs.length}개`);

    for (let i = 0; i < inputs.length; i++) {
      const name = await inputs[i].getAttribute('name');
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      const id = await inputs[i].getAttribute('id');
      console.log(`  ${i+1}. name="${name}", type="${type}", placeholder="${placeholder}", id="${id}"`);
    }

    // 모든 button 요소 찾기
    const buttons = await page.locator('button').all();
    console.log(`\n발견된 button: ${buttons.length}개`);
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent();
      const type = await buttons[i].getAttribute('type');
      console.log(`  ${i+1}. type="${type}", text="${text?.trim()}"`);
    }

    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await browser.close();
  }
}

exploreLogin();
