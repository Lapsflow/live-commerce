# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: complete-system.spec.ts >> Live Commerce 전체 시스템 테스트 >> 4. 바코드 스캔 페이지 확인
- Location: e2e/complete-system.spec.ts:50:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('input[type="text"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('input[type="text"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - img [ref=e4]
  - heading "This page couldn’t load" [level=1] [ref=e6]
  - paragraph [ref=e7]: Reload to try again, or go back.
  - generic [ref=e8]:
    - button "Reload" [ref=e10] [cursor=pointer]
    - button "Back" [ref=e11] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Live Commerce 전체 시스템 E2E 테스트
  5   |  * 모든 주요 기능을 순차적으로 검증
  6   |  */
  7   | 
  8   | const BASE_URL = 'https://live-commerce-opal.vercel.app';
  9   | 
  10  | test.describe('Live Commerce 전체 시스템 테스트', () => {
  11  | 
  12  |   test('1. 로그인 페이지 접근 및 UI 확인', async ({ page }) => {
  13  |     await page.goto(`${BASE_URL}/login`);
  14  | 
  15  |     // 로그인 폼 요소 확인 (아이디는 type="text", 비밀번호는 type="password")
  16  |     await expect(page.locator('input[type="text"]').first()).toBeVisible();
  17  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  18  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  19  | 
  20  |     // 헤더 텍스트 확인
  21  |     await expect(page.locator('h1')).toContainText(/라이브커머스|Live/i);
  22  | 
  23  |     console.log('✅ 로그인 페이지 UI 확인 완료');
  24  |   });
  25  | 
  26  |   test('2. 회원가입 페이지 확인', async ({ page }) => {
  27  |     await page.goto(`${BASE_URL}/signup`);
  28  | 
  29  |     // 회원가입 폼 요소 확인 (input은 placeholder로 구분)
  30  |     await expect(page.locator('input[placeholder*="아이디"]')).toBeVisible();
  31  |     await expect(page.locator('input[placeholder*="비밀번호"]')).toBeVisible();
  32  |     await expect(page.locator('input[placeholder*="이름"]')).toBeVisible();
  33  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  34  | 
  35  |     // 헤더 확인
  36  |     await expect(page.locator('h1')).toContainText(/회원가입/i);
  37  | 
  38  |     console.log('✅ 회원가입 페이지 확인 완료');
  39  |   });
  40  | 
  41  |   test('3. 홈페이지 리다이렉트 확인', async ({ page }) => {
  42  |     await page.goto(BASE_URL);
  43  | 
  44  |     // 홈페이지가 대시보드 또는 로그인으로 리다이렉트되는지 확인
  45  |     await page.waitForURL(/\/(dashboard|login)/);
  46  | 
  47  |     console.log('✅ 홈페이지 리다이렉트 확인 완료');
  48  |   });
  49  | 
  50  |   test('4. 바코드 스캔 페이지 확인', async ({ page }) => {
  51  |     await page.goto(`${BASE_URL}/barcode`);
  52  | 
  53  |     // 로그인 필요 시 로그인 페이지로 리다이렉트될 수 있음
  54  |     const currentUrl = page.url();
  55  | 
  56  |     if (currentUrl.includes('/login')) {
  57  |       console.log('⚠️  바코드 페이지는 로그인 필요 (예상된 동작)');
  58  |     } else {
  59  |       // 바코드 입력 필드 확인
> 60  |       await expect(page.locator('input[type="text"]')).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  61  |       await expect(page.locator('button:has-text("검색")')).toBeVisible();
  62  |       console.log('✅ 바코드 페이지 UI 확인 완료');
  63  |     }
  64  |   });
  65  | 
  66  |   test('5. 발주 관리 페이지 확인', async ({ page }) => {
  67  |     await page.goto(`${BASE_URL}/orders`);
  68  | 
  69  |     const currentUrl = page.url();
  70  | 
  71  |     if (currentUrl.includes('/login')) {
  72  |       console.log('⚠️  발주 페이지는 로그인 필요 (예상된 동작)');
  73  |     } else {
  74  |       // 발주 관리 페이지 헤더 확인
  75  |       await expect(page.locator('h1')).toContainText(/발주/i);
  76  |       console.log('✅ 발주 페이지 확인 완료');
  77  |     }
  78  |   });
  79  | 
  80  |   test('6. 방송 관리 페이지 확인', async ({ page }) => {
  81  |     await page.goto(`${BASE_URL}/broadcasts`);
  82  | 
  83  |     const currentUrl = page.url();
  84  | 
  85  |     if (currentUrl.includes('/login')) {
  86  |       console.log('⚠️  방송 페이지는 로그인 필요 (예상된 동작)');
  87  |     } else {
  88  |       // 방송 관리 페이지 헤더 확인
  89  |       await expect(page.locator('h1')).toContainText(/방송/i);
  90  |       console.log('✅ 방송 페이지 확인 완료');
  91  |     }
  92  |   });
  93  | 
  94  |   test('7. 방송 캘린더 페이지 확인', async ({ page }) => {
  95  |     await page.goto(`${BASE_URL}/broadcasts/calendar`);
  96  | 
  97  |     const currentUrl = page.url();
  98  | 
  99  |     if (currentUrl.includes('/login')) {
  100 |       console.log('⚠️  캘린더 페이지는 로그인 필요 (예상된 동작)');
  101 |     } else {
  102 |       // 캘린더 헤더 확인
  103 |       await expect(page.locator('h1')).toContainText(/캘린더|방송/i);
  104 |       console.log('✅ 방송 캘린더 페이지 확인 완료');
  105 |     }
  106 |   });
  107 | 
  108 |   test('8. 판매 현황 페이지 확인', async ({ page }) => {
  109 |     await page.goto(`${BASE_URL}/sales`);
  110 | 
  111 |     const currentUrl = page.url();
  112 | 
  113 |     if (currentUrl.includes('/login')) {
  114 |       console.log('⚠️  판매 페이지는 로그인 필요 (예상된 동작)');
  115 |     } else {
  116 |       // 판매 현황 페이지 헤더 확인
  117 |       await expect(page.locator('h1')).toContainText(/판매/i);
  118 |       console.log('✅ 판매 페이지 확인 완료');
  119 |     }
  120 |   });
  121 | 
  122 |   test('9. 사용자 관리 페이지 확인', async ({ page }) => {
  123 |     await page.goto(`${BASE_URL}/users`);
  124 | 
  125 |     const currentUrl = page.url();
  126 | 
  127 |     if (currentUrl.includes('/login')) {
  128 |       console.log('⚠️  사용자 관리 페이지는 로그인 필요 (예상된 동작)');
  129 |     } else {
  130 |       // 사용자 관리 페이지는 MASTER/SUB_MASTER만 접근 가능
  131 |       const hasAccess = await page.locator('h1:has-text("사용자")').isVisible().catch(() => false);
  132 |       const hasForbidden = await page.locator('text=/접근할 권한이 없습니다/').isVisible().catch(() => false);
  133 | 
  134 |       if (hasAccess) {
  135 |         console.log('✅ 사용자 관리 페이지 확인 완료 (MASTER 권한)');
  136 |       } else if (hasForbidden) {
  137 |         console.log('✅ 사용자 관리 권한 제한 확인 완료');
  138 |       }
  139 |     }
  140 |   });
  141 | 
  142 |   test('10. Proposal 페이지 확인', async ({ page }) => {
  143 |     await page.goto(`${BASE_URL}/proposals`);
  144 | 
  145 |     const currentUrl = page.url();
  146 | 
  147 |     if (currentUrl.includes('/login')) {
  148 |       console.log('⚠️  Proposal 페이지는 로그인 필요 (예상된 동작)');
  149 |     } else {
  150 |       // Proposal 페이지 헤더 확인
  151 |       await expect(page.locator('h1')).toContainText(/제안|Proposal/i);
  152 |       console.log('✅ Proposal 페이지 확인 완료');
  153 |     }
  154 |   });
  155 | 
  156 |   test('11. API 헬스 체크 - Products', async ({ request }) => {
  157 |     const response = await request.get(`${BASE_URL}/api/products`);
  158 | 
  159 |     // 인증 필요 또는 정상 응답
  160 |     expect([200, 401]).toContain(response.status());
```