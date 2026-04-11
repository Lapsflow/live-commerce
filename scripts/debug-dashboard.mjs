import { chromium } from 'playwright';

async function checkConsole() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    logs.push({ type: msg.type(), text: msg.text() });
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  try {
    console.log('1. 로그인...');
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type="email"]', 'admin1@live-commerce.com');
    await page.fill('input[type="password"]', 'admin1234');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('2. 대시보드 접근...');
    await page.goto('http://localhost:3001/admin/dashboard');
    await page.waitForTimeout(10000);

    console.log('\n3. 콘솔 로그:');
    logs.forEach(log => {
      if (!log.text.includes('Download the React DevTools')) {
        console.log(`  [${log.type}] ${log.text}`);
      }
    });

    console.log('\n4. 페이지 에러:');
    if (errors.length === 0) {
      console.log('  (에러 없음)');
    } else {
      errors.forEach(err => console.log(`  ${err}`));
    }

    // HTML 구조 확인
    const html = await page.content();
    const hasWidget = html.includes('OnewmsStatusWidget') || html.includes('ONEWMS');
    console.log('\n5. HTML에 ONEWMS 관련 내용 존재:', hasWidget);

    // React 컴포넌트 확인
    const hasReactRoot = html.includes('__next');
    console.log('6. React 앱 로드 완료:', hasReactRoot);

    // Check for specific elements
    const cardTitle = await page.locator('h3').allTextContents();
    console.log('\n7. 모든 h3 제목:', cardTitle);

    await page.waitForTimeout(5000);
  } catch (error) {
    console.error('에러:', error.message);
  } finally {
    await browser.close();
  }
}

checkConsole();
