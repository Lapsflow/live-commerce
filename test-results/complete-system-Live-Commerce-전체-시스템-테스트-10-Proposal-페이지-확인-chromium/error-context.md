# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: complete-system.spec.ts >> Live Commerce 전체 시스템 테스트 >> 10. Proposal 페이지 확인
- Location: e2e/complete-system.spec.ts:142:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected pattern: /제안|Proposal/i
Received string:  "This page couldn’t load"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h1')
    9 × locator resolved to <h1>This page couldn’t load</h1>
      - unexpected value "This page couldn’t load"

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
  51  |     await page.goto(`${BASE_URL}/barcode`);
  52  | 
  53  |     // 로그인 필요 시 로그인 페이지로 리다이렉트될 수 있음
  54  |     const currentUrl = page.url();
  55  | 
  56  |     if (currentUrl.includes('/login')) {
  57  |       console.log('⚠️  바코드 페이지는 로그인 필요 (예상된 동작)');
  58  |     } else {
  59  |       // 바코드 입력 필드 확인
  60  |       await expect(page.locator('input[type="text"]')).toBeVisible();
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
> 151 |       await expect(page.locator('h1')).toContainText(/제안|Proposal/i);
      |                                        ^ Error: expect(locator).toContainText(expected) failed
  152 |       console.log('✅ Proposal 페이지 확인 완료');
  153 |     }
  154 |   });
  155 | 
  156 |   test('11. API 헬스 체크 - Products', async ({ request }) => {
  157 |     const response = await request.get(`${BASE_URL}/api/products`);
  158 | 
  159 |     // 인증 필요 또는 정상 응답
  160 |     expect([200, 401]).toContain(response.status());
  161 | 
  162 |     console.log(`✅ Products API 응답: ${response.status()}`);
  163 |   });
  164 | 
  165 |   test('12. API 헬스 체크 - Broadcasts', async ({ request }) => {
  166 |     const response = await request.get(`${BASE_URL}/api/broadcasts`);
  167 | 
  168 |     // 인증 필요 또는 정상 응답
  169 |     expect([200, 401]).toContain(response.status());
  170 | 
  171 |     console.log(`✅ Broadcasts API 응답: ${response.status()}`);
  172 |   });
  173 | 
  174 |   test('13. API 헬스 체크 - Orders', async ({ request }) => {
  175 |     const response = await request.get(`${BASE_URL}/api/orders`);
  176 | 
  177 |     // 인증 필요 또는 정상 응답
  178 |     expect([200, 401]).toContain(response.status());
  179 | 
  180 |     console.log(`✅ Orders API 응답: ${response.status()}`);
  181 |   });
  182 | 
  183 |   test('14. API 헬스 체크 - Sales', async ({ request }) => {
  184 |     const response = await request.get(`${BASE_URL}/api/sales`);
  185 | 
  186 |     // 인증 필요 또는 정상 응답
  187 |     expect([200, 401]).toContain(response.status());
  188 | 
  189 |     console.log(`✅ Sales API 응답: ${response.status()}`);
  190 |   });
  191 | 
  192 |   test('15. API 헬스 체크 - Dashboard Stats', async ({ request }) => {
  193 |     const response = await request.get(`${BASE_URL}/api/stats/dashboard`);
  194 | 
  195 |     // 인증 필요 또는 정상 응답
  196 |     expect([200, 401]).toContain(response.status());
  197 | 
  198 |     console.log(`✅ Dashboard Stats API 응답: ${response.status()}`);
  199 |   });
  200 | 
  201 |   test('16. 전체 네비게이션 테스트', async ({ page }) => {
  202 |     await page.goto(`${BASE_URL}/login`);
  203 | 
  204 |     // 로그인 페이지에서 회원가입 링크 확인
  205 |     const signupLink = page.locator('a:has-text("회원가입")');
  206 |     if (await signupLink.isVisible()) {
  207 |       await signupLink.click();
  208 |       await expect(page).toHaveURL(/signup/);
  209 |       console.log('✅ 로그인 → 회원가입 네비게이션 확인');
  210 |     }
  211 | 
  212 |     // 회원가입에서 로그인으로 돌아가기
  213 |     const loginLink = page.locator('a:has-text("로그인")');
  214 |     if (await loginLink.isVisible()) {
  215 |       await loginLink.click();
  216 |       await expect(page).toHaveURL(/login/);
  217 |       console.log('✅ 회원가입 → 로그인 네비게이션 확인');
  218 |     }
  219 |   });
  220 | 
  221 |   test('17. 페이지 로딩 성능 체크', async ({ page }) => {
  222 |     const pages = [
  223 |       '/login',
  224 |       '/signup',
  225 |       '/barcode',
  226 |     ];
  227 | 
  228 |     for (const path of pages) {
  229 |       const startTime = Date.now();
  230 |       await page.goto(`${BASE_URL}${path}`);
  231 |       const loadTime = Date.now() - startTime;
  232 | 
  233 |       console.log(`📊 ${path} 로딩 시간: ${loadTime}ms`);
  234 | 
  235 |       // 5초 이내 로딩 확인
  236 |       expect(loadTime).toBeLessThan(5000);
  237 |     }
  238 | 
  239 |     console.log('✅ 페이지 로딩 성능 확인 완료');
  240 |   });
  241 | 
  242 |   test('18. 반응형 디자인 테스트 - 모바일', async ({ page }) => {
  243 |     // 모바일 뷰포트 설정
  244 |     await page.setViewportSize({ width: 375, height: 667 });
  245 |     await page.goto(`${BASE_URL}/login`);
  246 | 
  247 |     // 모바일에서도 로그인 폼이 보이는지 확인
  248 |     await expect(page.locator('input[type="text"]').first()).toBeVisible();
  249 |     await expect(page.locator('input[type="password"]')).toBeVisible();
  250 | 
  251 |     console.log('✅ 모바일 반응형 디자인 확인 완료');
```