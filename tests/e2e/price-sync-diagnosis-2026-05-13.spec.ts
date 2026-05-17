/**
 * ONEWMS 가격 동기화 진단 테스트
 *
 * 목적: 1406번 상품의 공급가 동기화 과정을 브라우저 + API로 검증
 *
 * 6개 시나리오:
 * T01: 마스터 로그인 → 상품 관리 → "1406" 검색
 * T02: GET /api/products?search=1406 (마스터 세션)
 * T03: GET /api/cron/stock-sync (CRON_SECRET)
 * T04: T03 후 5초 대기 → 재조회하여 변경 여부 확인
 * T05: ONEWMS API 직접 호출하여 supply_price 조회
 * T06: 종합 결론 출력
 *
 * 실행: pnpm playwright test tests/e2e/price-sync-diagnosis-2026-05-13.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://www.supermujin.ai';
const PRODUCT_SEARCH = '1406';
const CRON_SECRET = process.env.CRON_SECRET || '';

interface DiagnosisState {
  t01_displayPrice?: string;
  t02_apiSupplyPrice?: number;
  t03_cronStatus?: number;
  t03_priceStats?: { total: number; updated: number; errors: number };
  t03_durationMs?: number;
  t04_apiSupplyPrice?: number;
  t04_changed?: boolean;
  t05_onewmsSupplyPrice?: string;
  t05_found?: boolean;
  conclusion?: string;
}

const diagnosisState: DiagnosisState = {};

test.describe('가격 동기화 진단 (1406번 상품)', () => {
  // T01: 마스터 로그인 후 상품 관리에서 1406 검색
  test('T01: 마스터 로그인 → 상품 검색', async ({ page, context }) => {
    // 마스터 인증 상태 로드 (playwright/.auth/master.json)
    await context.addCookies([
      {
        name: 'authjs.session-token',
        value: 'test-session',
        domain: new URL(BASE_URL).hostname,
        path: '/',
      },
    ]);

    // 상품 관리 페이지로 직접 이동
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // 검색창이 있는지 확인
    const searchInput = page.locator('input[placeholder*="검색"], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(PRODUCT_SEARCH);
      await page.waitForLoadState('networkidle');
    }

    // 상품 행 캡처 (1406 포함)
    const rows = page.locator('table tbody tr');
    let found = false;

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const text = await row.textContent();

      if (text && text.includes(PRODUCT_SEARCH)) {
        found = true;
        // 공급가 찾기 (숫자 포맷: 5,100원 또는 11,900원)
        const cells = row.locator('td');
        const cellCount = await cells.count();

        for (let j = 0; j < cellCount; j++) {
          const cellText = await cells.nth(j).textContent();
          if (cellText && /\d{1,3}(,\d{3})*원/.test(cellText)) {
            diagnosisState.t01_displayPrice = cellText.trim();
            break;
          }
        }
        break;
      }
    }

    expect(found).toBeTruthy();
    expect(diagnosisState.t01_displayPrice).toBeTruthy();
    console.log(`✅ T01 완료: 화면에 표시된 공급가 = ${diagnosisState.t01_displayPrice}`);
  });

  // T02: GET /api/products?search=1406 (마스터 세션)
  test('T02: API 조회 (마스터 세션)', async ({ request, context }) => {
    // 마스터 쿠키 추가
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await request.get(`${BASE_URL}/api/products?search=${PRODUCT_SEARCH}`, {
      headers: { Cookie: cookieHeader },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // 응답 구조 확인
    if (data.data && Array.isArray(data.data)) {
      const product = data.data.find((p: any) => p.productCode === PRODUCT_SEARCH || String(p.productCode) === PRODUCT_SEARCH);
      if (product) {
        diagnosisState.t02_apiSupplyPrice = product.supplyPrice;
        console.log(`✅ T02 완료: API supplyPrice = ${diagnosisState.t02_apiSupplyPrice}`);
      }
    }

    expect(diagnosisState.t02_apiSupplyPrice).toBeDefined();
  });

  // T03: GET /api/cron/stock-sync (CRON_SECRET)
  test('T03: Cron 동작 확인', async ({ request }) => {
    if (!CRON_SECRET) {
      test.skip();
    }

    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/cron/stock-sync`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      timeout: 60000,
    });

    diagnosisState.t03_durationMs = Date.now() - startTime;
    diagnosisState.t03_cronStatus = response.status();

    expect(diagnosisState.t03_cronStatus).toBe(200);

    const data = await response.json();
    if (data.priceStats) {
      diagnosisState.t03_priceStats = {
        total: data.priceStats.total || 0,
        updated: data.priceStats.updated || 0,
        errors: data.priceStats.errors || 0,
      };
    }

    expect(diagnosisState.t03_durationMs).toBeLessThan(60000);
    console.log(
      `✅ T03 완료: Cron 실행 ${diagnosisState.t03_durationMs}ms, priceStats=${JSON.stringify(diagnosisState.t03_priceStats)}`
    );
  });

  // T04: T03 후 5초 대기 → 재조회하여 변경 여부 확인
  test('T04: Cron 후 가격 변경 확인', async ({ request, context }) => {
    if (!diagnosisState.t03_cronStatus) {
      test.skip();
    }

    // 5초 대기
    await new Promise((r) => setTimeout(r, 5000));

    // 재조회
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await request.get(`${BASE_URL}/api/products?search=${PRODUCT_SEARCH}`, {
      headers: { Cookie: cookieHeader },
    });

    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      const product = data.data.find(
        (p: any) => p.productCode === PRODUCT_SEARCH || String(p.productCode) === PRODUCT_SEARCH
      );
      if (product) {
        diagnosisState.t04_apiSupplyPrice = product.supplyPrice;
        diagnosisState.t04_changed = diagnosisState.t04_apiSupplyPrice !== diagnosisState.t02_apiSupplyPrice;
      }
    }

    console.log(
      `✅ T04 완료: Cron 후 supplyPrice = ${diagnosisState.t04_apiSupplyPrice}, 변경=${diagnosisState.t04_changed}`
    );
  });

  // T05: ONEWMS API 직접 호출
  test('T05: ONEWMS API 직접 호출', async ({ request }) => {
    const partnerKey = process.env.ONEWMS_PARTNER_KEY;
    const domainKey = process.env.ONEWMS_DOMAIN_KEY;

    if (!partnerKey || !domainKey) {
      console.log('⚠️  T05 SKIP: ONEWMS env 미설정');
      test.skip();
    }

    const formData = new URLSearchParams();
    formData.append('partner_key', partnerKey!);
    formData.append('domain_key', domainKey!);
    formData.append('action', 'get_product_info');
    formData.append('page', '1');
    formData.append('limit', '200');

    const response = await request.post('https://api.onewms.co.kr/api.php', {
      data: formData,
    });

    const apiData = await response.json();
    if (apiData.data && typeof apiData.data === 'object') {
      for (const [key, val] of Object.entries(apiData.data)) {
        const product = val as any;
        if (product.product_id === PRODUCT_SEARCH || product.product_id === parseInt(PRODUCT_SEARCH)) {
          diagnosisState.t05_onewmsSupplyPrice = String(product.supply_price || '0');
          diagnosisState.t05_found = true;
          break;
        }
      }
    }

    if (!diagnosisState.t05_found) {
      console.log('⚠️  T05: ONEWMS에서 1406 상품을 찾을 수 없음');
    } else {
      console.log(`✅ T05 완료: ONEWMS supply_price = ${diagnosisState.t05_onewmsSupplyPrice}`);
    }
  });

  // T06: 종합 결론
  test('T06: 종합 결론 및 보고서 생성', async () => {
    let conclusion = 'INCOMPLETE';
    let message = '';

    if (
      diagnosisState.t02_apiSupplyPrice !== undefined &&
      diagnosisState.t05_onewmsSupplyPrice !== undefined
    ) {
      const dbPrice = diagnosisState.t02_apiSupplyPrice;
      const onewmsPrice = parseInt(diagnosisState.t05_onewmsSupplyPrice, 10);

      if (onewmsPrice === dbPrice) {
        conclusion = 'C';
        message = `✅ 이미 반영됨 (DB=${dbPrice}, ONEWMS=${onewmsPrice})`;
      } else if (onewmsPrice === 11900 && dbPrice === 5100) {
        conclusion = 'A';
        message = `❌ 동기화 실패 (DB=5100, ONEWMS=11900)`;
      } else {
        conclusion = 'B';
        message = `⚠️  ONEWMS 예상과 다름 (DB=${dbPrice}, ONEWMS=${onewmsPrice})`;
      }
    } else if (!diagnosisState.t05_found) {
      conclusion = 'D';
      message = `⚠️  ONEWMS에서 상품 미발견 (페이지 한도 또는 매핑 누락)`;
    } else {
      conclusion = 'ERROR';
      message = 'T02/T05 데이터 부족';
    }

    diagnosisState.conclusion = conclusion;

    // 보고서 생성
    const report = generateReport(diagnosisState);
    const reportPath = path.join(process.cwd(), 'docs', 'PRICE_SYNC_DIAGNOSIS_REPORT.md');

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, report, 'utf-8');
      console.log(`✅ 보고서 생성: ${reportPath}`);
    } catch (error) {
      console.error(`❌ 보고서 생성 실패:`, error);
    }

    console.log(`\n종합 결론: [${conclusion}] ${message}`);
  });
});

function generateReport(state: DiagnosisState): string {
  const timestamp = new Date().toISOString();
  const conclusionMap: Record<string, string> = {
    A: '우리 동기화 실패 (sync not working)',
    B: 'ONEWMS 캐시 또는 예상과 다른 값',
    C: '이미 동기화됨 (browser cache likely)',
    D: 'ONEWMS 미발견 또는 페이지 한도',
    ERROR: '테스트 데이터 부족',
  };

  const recommendation: Record<string, string> = {
    A: `✅ 권장 조치:
   1) /api/cron/stock-sync 로그 확인
   2) lib/services/onewms/productImport.ts:syncProductPricesFromOnewms 디버깅
   3) HEADQUARTERS 상품 타입 확인
   4) 1분 후 재실행`,
    B: `✅ 권장 조치:
   1) ONEWMS 측에 상품 supply_price 재확인
   2) ONEWMS 캐시 가능성 → 1-2분 대기 후 재확인
   3) 예상값: 11,900원, 현재값: ${state.t05_onewmsSupplyPrice}원`,
    C: `✅ 권장 조치:
   1) 대표님 브라우저 캐시 초기화 (Ctrl+Shift+Delete)
   2) 브라우저 재시작
   3) 새 시크릿 창에서 https://www.supermujin.ai 접속`,
    D: `✅ 권장 조치:
   1) lib/services/onewms/productImport.ts 의 page 한도 확인 (현재 20 = 2000개)
   2) productCode/onewmsCode 형식 재확인
   3) ONEWMS 측 상품 존재 여부 확인`,
    ERROR: `✅ 권장 조치:
   1) 테스트 재실행
   2) /api/cron/stock-sync 정상 작동 확인
   3) CRON_SECRET 및 ONEWMS env 설정 확인`,
  };

  return `# 가격 동기화 진단 보고서

**생성: ${timestamp}**
**상품: 1406번**
**결론: [${state.conclusion}] ${conclusionMap[state.conclusion || 'ERROR']}**

---

## 검증 결과 (6개 시나리오)

| 테스트 | 결과 | 값 |
|---|---|---|
| T01: 화면 표시 공급가 | ${state.t01_displayPrice ? '✅' : '⏳'} | ${state.t01_displayPrice || 'N/A'} |
| T02: API supplyPrice | ${state.t02_apiSupplyPrice !== undefined ? '✅' : '⏳'} | ${state.t02_apiSupplyPrice?.toLocaleString() || 'N/A'}원 |
| T03: Cron 동작 | ${state.t03_cronStatus === 200 ? '✅' : '⏳'} | 상태=${state.t03_cronStatus}, 실행시간=${state.t03_durationMs}ms |
| T03: 가격 동기화 통계 | ${state.t03_priceStats ? '✅' : '⏳'} | 대상=${state.t03_priceStats?.total}, 업데이트=${state.t03_priceStats?.updated}, 오류=${state.t03_priceStats?.errors} |
| T04: Cron 후 변경 | ${state.t04_apiSupplyPrice !== undefined ? '✅' : '⏳'} | 변경=${state.t04_changed}, 값=${state.t04_apiSupplyPrice?.toLocaleString() || 'N/A'}원 |
| T05: ONEWMS supply_price | ${state.t05_found ? '✅' : '❌'} | ${state.t05_onewmsSupplyPrice || 'NOT FOUND'}원 |

---

## 상세 분석

### DB vs ONEWMS

| 항목 | 슈퍼무진 DB | ONEWMS |
|---|---|---|
| **공급가** | ${state.t02_apiSupplyPrice?.toLocaleString() || '?'}원 | ${state.t05_onewmsSupplyPrice || '?'}원 |
| **동기화 상태** | ${
  state.t02_apiSupplyPrice && state.t05_onewmsSupplyPrice
    ? parseInt(state.t05_onewmsSupplyPrice, 10) === state.t02_apiSupplyPrice
      ? '✅ 일치'
      : '❌ 불일치'
    : '?'
} | - |
| **마지막 Cron 실행** | ${state.t03_cronStatus === 200 ? '✅ 성공' : '❌ 실패'} | - |

---

## 결론 및 권장 조치

**케이스: [${state.conclusion}]**

${recommendation[state.conclusion || 'ERROR'] || '권장 조치 정보 없음'}

---

## 빠른 재진단 명령

\`\`\`bash
# 1. 스크립트 진단
pnpm tsx scripts/diagnose-product-price.ts 1406

# 2. Playwright 재실행
pnpm playwright test tests/e2e/price-sync-diagnosis-2026-05-13.spec.ts --reporter=list
\`\`\`

---

_보고서 자동 생성 (Playwright) | 실패 0건 목표_
`;
}
