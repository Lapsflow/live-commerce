import { chromium } from 'playwright';

const BASE = 'https://www.supermujin.ai';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: 'playwright/.auth/supermujin.json' });
  const page = await ctx.newPage();

  const TS = Date.now().toString(36).slice(-5);
  const username = 'e2e_sub_' + TS;
  const password = 'Test12345678';

  // Create user
  const res = await page.request.post(`${BASE}/api/users`, {
    headers: { Origin: BASE, 'Content-Type': 'application/json' },
    data: {
      username,
      password,
      name: 'E2E서브마스터',
      email: username + '@test.com',
      role: 'SUB_MASTER',
    }
  });
  const json = await res.json();
  const userId = json.data?.id;
  console.log('Create status:', res.status(), userId || json.error?.message);

  if (!userId) {
    await browser.close();
    process.exit(1);
  }

  // Set mustChangePassword = false
  const patchRes = await page.request.put(`${BASE}/api/users/${userId}`, {
    headers: { Origin: BASE, 'Content-Type': 'application/json' },
    data: { mustChangePassword: false }
  });
  console.log('Patch mustChangePassword:', patchRes.status());

  await browser.close();

  // Login as that user
  const browser2 = await chromium.launch({ headless: true });
  const ctx2 = await browser2.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/login`);
  await page2.waitForSelector('input[placeholder="아이디를 입력하세요"]', { timeout: 10000 });
  await page2.fill('input[placeholder="아이디를 입력하세요"]', username);
  await page2.fill('input[placeholder="비밀번호를 입력하세요"]', password);
  await page2.click('button[type="submit"]');
  await page2.waitForURL('**/dashboard**', { timeout: 15000 });

  console.log('Logged in as SUB_MASTER:', page2.url());
  await ctx2.storageState({ path: 'playwright/.auth/supermujin-submaster.json' });
  console.log('Saved submaster auth state');
  console.log('USER_ID=' + userId);
  console.log('USERNAME=' + username);

  await browser2.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
