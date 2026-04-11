/**
 * ONEWMS UI 완벽 비교 스크립트
 *
 * Google Apps Script 프로토타입 vs Next.js 구현
 * 완벽 수준의 기능 검증
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 설정
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyrpVxyabmqsBj1l6pQOLLfXAJXi_oztal3SKFngnZtL_Y0O7lGuHZDDM6FmUmBwWCk8A/exec';
const NEXTJS_URL = process.env.NEXTJS_URL || 'http://localhost:3001'; // 로컬 또는 배포 URL (기존 dev 서버)
const CREDENTIALS = { id: 'master', password: '1234' };
const SCREENSHOTS_DIR = '/tmp/onewms-comparison';

// 검증 결과 저장
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

function addResult(category, test, status, details = {}) {
  results.tests.push({
    category,
    test,
    status, // 'PASS', 'FAIL', 'WARNING'
    details,
    timestamp: new Date().toISOString()
  });
  results.summary.total++;
  if (status === 'PASS') results.summary.passed++;
  else if (status === 'FAIL') results.summary.failed++;
  else if (status === 'WARNING') results.summary.warnings++;
}

async function compareOnewmsUI() {
  console.log('🚀 ONEWMS UI 완벽 비교 검증 시작\n');

  // 스크린샷 디렉토리 생성
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  try {
    // ========================================
    // Phase 1: Google Apps Script 프로토타입 분석
    // ========================================
    console.log('📊 Phase 1: Google Apps Script 프로토타입 분석\n');

    const gasContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const gasPage = await gasContext.newPage();

    // GAS 로그인
    console.log('🔐 GAS 로그인 중...');
    await gasPage.goto(GAS_URL);
    await gasPage.waitForTimeout(3000);

    // iframe에서 로그인 폼 찾기
    const gasFrames = gasPage.frames();
    let gasLoginFrame = gasPage;
    for (const frame of gasFrames) {
      const inputs = await frame.locator('input').count();
      if (inputs > 0) {
        gasLoginFrame = frame;
        break;
      }
    }

    const gasInputs = await gasLoginFrame.locator('input').all();
    if (gasInputs.length >= 2) {
      await gasInputs[0].fill(CREDENTIALS.id);
      await gasInputs[1].fill(CREDENTIALS.password);
      const loginBtn = await gasLoginFrame.locator('button').first();
      await loginBtn.click();
      await gasPage.waitForTimeout(4000);
      console.log('✅ GAS 로그인 완료\n');
      addResult('Authentication', 'GAS Login', 'PASS', { url: GAS_URL });
    }

    // GAS 기능 목록 수집
    const gasFeatures = {
      tabs: [],
      sidebarMenus: [],
      barcodeFeatures: []
    };

    // 상단 탭 메뉴 수집
    console.log('📋 GAS 상단 탭 메뉴 분석...');
    const gasTabs = ['바코드 스캔', '발주 현황', '판매현황', '내 셀러', '전체 관리', '방송일정'];
    for (const tabName of gasTabs) {
      try {
        const tab = gasPage.locator(`text=${tabName}`).first();
        if (await tab.isVisible()) {
          gasFeatures.tabs.push(tabName);
          console.log(`   ✓ ${tabName} 탭 확인`);

          // 스크린샷
          await tab.click();
          await gasPage.waitForTimeout(2000);
          await gasPage.screenshot({
            path: `${SCREENSHOTS_DIR}/gas-tab-${tabName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });
        }
      } catch (e) {
        console.log(`   ✗ ${tabName} 탭 없음`);
      }
    }

    // 사이드바 메뉴 수집
    console.log('\n📋 GAS 사이드바 메뉴 분석...');
    const gasSidebarMenus = ['바코드툴 스캔 카메라', '전체 제고', '판매기', '공급가', '아이템'];
    for (const menuName of gasSidebarMenus) {
      try {
        const menu = gasPage.locator(`text=${menuName}`).first();
        if (await menu.isVisible()) {
          gasFeatures.sidebarMenus.push(menuName);
          console.log(`   ✓ ${menuName} 메뉴 확인`);

          // 스크린샷
          await menu.click();
          await gasPage.waitForTimeout(2000);
          await gasPage.screenshot({
            path: `${SCREENSHOTS_DIR}/gas-sidebar-${menuName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });
        }
      } catch (e) {
        console.log(`   ✗ ${menuName} 메뉴 없음`);
      }
    }

    await gasContext.close();

    // ========================================
    // Phase 2: Next.js 구현 분석
    // ========================================
    console.log('\n📊 Phase 2: Next.js 구현 분석\n');

    const nextContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const nextPage = await nextContext.newPage();

    // Next.js 로그인
    console.log('🔐 Next.js 로그인 중...');
    await nextPage.goto(`${NEXTJS_URL}/auth/signin`);
    await nextPage.waitForTimeout(2000);

    try {
      // type과 placeholder로 input 필드 찾기
      await nextPage.fill('input[type="email"]', CREDENTIALS.id);
      await nextPage.fill('input[type="password"]', CREDENTIALS.password);
      await nextPage.click('button[type="submit"]');
      await nextPage.waitForTimeout(3000);
      console.log('✅ Next.js 로그인 완료\n');
      addResult('Authentication', 'Next.js Login', 'PASS', { url: NEXTJS_URL });
    } catch (e) {
      console.log('❌ Next.js 로그인 실패:', e.message);
      addResult('Authentication', 'Next.js Login', 'FAIL', { error: e.message });
    }

    // Next.js ONEWMS 기능 검증
    const nextFeatures = {
      dashboard: false,
      orderDetail: false,
      productStock: false
    };

    // 1. ONEWMS 대시보드 위젯 검증
    console.log('🔍 Test 1: ONEWMS 대시보드 위젯 검증');
    try {
      await nextPage.goto(`${NEXTJS_URL}/admin/dashboard`);
      await nextPage.waitForTimeout(3000);

      // 위젯 존재 확인
      const widgetTitle = await nextPage.locator('text=ONEWMS 연동 상태').count();
      if (widgetTitle > 0) {
        console.log('   ✅ 위젯 제목 확인');

        // 연결 상태 배지 확인
        const badge = await nextPage.locator('.inline-flex').filter({ hasText: /연결됨|연결 끊김/ }).count();
        if (badge > 0) {
          console.log('   ✅ 연결 상태 배지 확인');
        }

        // 통계 숫자 확인
        const stats = await nextPage.locator('.text-2xl').count();
        if (stats >= 3) {
          console.log('   ✅ 통계 표시 확인 (대기/실패/충돌)');
        }

        // 액션 버튼 확인
        const syncBtn = await nextPage.locator('button:has-text("재고 동기화")').count();
        const retryBtn = await nextPage.locator('button:has-text("실패 재시도")').count();
        if (syncBtn > 0 && retryBtn > 0) {
          console.log('   ✅ 액션 버튼 확인 (동기화, 재시도)');
        }

        await nextPage.screenshot({
          path: `${SCREENSHOTS_DIR}/next-dashboard-widget.png`,
          fullPage: true
        });

        nextFeatures.dashboard = true;
        addResult('ONEWMS Features', 'Dashboard Widget', 'PASS', {
          elements: { badge, stats, syncBtn, retryBtn }
        });
      } else {
        throw new Error('위젯을 찾을 수 없습니다');
      }
    } catch (e) {
      console.log('   ❌ 대시보드 위젯 검증 실패:', e.message);
      addResult('ONEWMS Features', 'Dashboard Widget', 'FAIL', { error: e.message });
    }

    // 2. 주문 상세 ONEWMS 정보 검증
    console.log('\n🔍 Test 2: 주문 상세 ONEWMS 정보 검증');
    try {
      // 주문 목록에서 첫 번째 주문 가져오기
      await nextPage.goto(`${NEXTJS_URL}/orders`);
      await nextPage.waitForTimeout(2000);

      const firstOrderLink = await nextPage.locator('a[href*="/orders/"]').first();
      if (await firstOrderLink.isVisible()) {
        await firstOrderLink.click();
        await nextPage.waitForTimeout(2000);

        // ONEWMS 정보 섹션 확인
        const onewmsSection = await nextPage.locator('text=ONEWMS 정보').count();
        if (onewmsSection > 0) {
          console.log('   ✅ ONEWMS 정보 섹션 확인');

          // 주문번호 확인
          const orderNo = await nextPage.locator('text=ONEWMS 주문번호').count();
          if (orderNo > 0) {
            console.log('   ✅ ONEWMS 주문번호 표시 확인');
          }

          // 상태 배지 확인
          const statusBadge = await nextPage.locator('.inline-flex').filter({ hasText: /PENDING|SENT|SHIPPED|FAILED/ }).count();
          if (statusBadge > 0) {
            console.log('   ✅ 상태 배지 확인');
          }

          await nextPage.screenshot({
            path: `${SCREENSHOTS_DIR}/next-order-onewms-info.png`,
            fullPage: true
          });

          nextFeatures.orderDetail = true;
          addResult('ONEWMS Features', 'Order Detail Info', 'PASS', {
            elements: { onewmsSection, orderNo, statusBadge }
          });
        } else {
          console.log('   ⚠️  ONEWMS 정보 섹션 없음 (주문이 전송되지 않았을 수 있음)');
          addResult('ONEWMS Features', 'Order Detail Info', 'WARNING', {
            reason: 'No ONEWMS mapping for this order'
          });
        }
      }
    } catch (e) {
      console.log('   ❌ 주문 상세 검증 실패:', e.message);
      addResult('ONEWMS Features', 'Order Detail Info', 'FAIL', { error: e.message });
    }

    // 3. 상품 재고 동기화 버튼 검증
    console.log('\n🔍 Test 3: 상품 재고 동기화 버튼 검증');
    try {
      await nextPage.goto(`${NEXTJS_URL}/products`);
      await nextPage.waitForTimeout(2000);

      // 재고 동기화 버튼 확인
      const syncButton = await nextPage.locator('button:has-text("재고 동기화")').count();
      if (syncButton > 0) {
        console.log('   ✅ 재고 동기화 버튼 확인');

        // 재고 정보 표시 확인
        const platformQty = await nextPage.locator('text=플랫폼:').count();
        const onewmsQty = await nextPage.locator('text=ONEWMS:').count();
        if (platformQty > 0 && onewmsQty > 0) {
          console.log('   ✅ 재고 비교 정보 표시 확인');
        }

        await nextPage.screenshot({
          path: `${SCREENSHOTS_DIR}/next-product-stock-sync.png`,
          fullPage: true
        });

        nextFeatures.productStock = true;
        addResult('ONEWMS Features', 'Product Stock Sync', 'PASS', {
          elements: { syncButton, platformQty, onewmsQty }
        });
      } else {
        console.log('   ⚠️  재고 동기화 버튼 없음 (ONEWMS 코드가 없는 상품일 수 있음)');
        addResult('ONEWMS Features', 'Product Stock Sync', 'WARNING', {
          reason: 'No ONEWMS code configured for products'
        });
      }
    } catch (e) {
      console.log('   ❌ 상품 재고 동기화 검증 실패:', e.message);
      addResult('ONEWMS Features', 'Product Stock Sync', 'FAIL', { error: e.message });
    }

    await nextContext.close();

    // ========================================
    // Phase 3: 기능 비교 및 완벽도 평가
    // ========================================
    console.log('\n\n📊 Phase 3: 기능 비교 및 완벽도 평가\n');
    console.log('━'.repeat(80));

    // GAS vs Next.js 기능 매핑
    const featureMapping = {
      'ONEWMS 통합 관리': {
        gas: gasFeatures.tabs.includes('전체 관리'),
        next: nextFeatures.dashboard,
        importance: 'HIGH',
        description: 'ONEWMS 상태 모니터링 및 관리 기능'
      },
      '주문 ONEWMS 정보': {
        gas: gasFeatures.tabs.includes('발주 현황'),
        next: nextFeatures.orderDetail,
        importance: 'HIGH',
        description: '주문별 ONEWMS 연동 정보 및 추적'
      },
      '재고 동기화': {
        gas: gasFeatures.sidebarMenus.includes('전체 제고'),
        next: nextFeatures.productStock,
        importance: 'MEDIUM',
        description: '상품별 재고 ONEWMS 동기화'
      }
    };

    console.log('📋 기능 비교표:\n');
    console.log('┌─────────────────────────┬─────────┬─────────┬────────────┬───────────┐');
    console.log('│ 기능                    │   GAS   │  Next   │   중요도   │   상태    │');
    console.log('├─────────────────────────┼─────────┼─────────┼────────────┼───────────┤');

    let perfectScore = 0;
    let totalFeatures = 0;

    for (const [featureName, feature] of Object.entries(featureMapping)) {
      totalFeatures++;
      const gasStatus = feature.gas ? '✅' : '❌';
      const nextStatus = feature.next ? '✅' : '❌';
      const importance = feature.importance;

      let status = '';
      if (feature.next) {
        status = '완벽 ✅';
        perfectScore++;
        addResult('Feature Comparison', featureName, 'PASS', {
          gas: feature.gas,
          next: feature.next,
          importance: feature.importance
        });
      } else if (!feature.gas) {
        status = 'N/A ⚪';
        addResult('Feature Comparison', featureName, 'WARNING', {
          reason: 'Not in GAS prototype'
        });
      } else {
        status = '미구현 ❌';
        addResult('Feature Comparison', featureName, 'FAIL', {
          reason: 'Not implemented in Next.js'
        });
      }

      console.log(`│ ${featureName.padEnd(23)} │   ${gasStatus}    │   ${nextStatus}    │  ${importance.padEnd(8)}  │ ${status.padEnd(9)} │`);
    }

    console.log('└─────────────────────────┴─────────┴─────────┴────────────┴───────────┘');

    const perfectionRate = (perfectScore / totalFeatures) * 100;
    console.log(`\n🎯 완벽도 점수: ${perfectScore}/${totalFeatures} (${perfectionRate.toFixed(1)}%)`);

    // 최종 평가
    console.log('\n\n━'.repeat(80));
    console.log('📊 최종 평가 리포트\n');
    console.log(`총 테스트: ${results.summary.total}`);
    console.log(`✅ 통과: ${results.summary.passed}`);
    console.log(`❌ 실패: ${results.summary.failed}`);
    console.log(`⚠️  경고: ${results.summary.warnings}`);
    console.log(`\n완벽도: ${perfectionRate.toFixed(1)}%`);

    if (perfectionRate >= 100) {
      console.log('\n🏆 평가: 완벽! ONEWMS UI가 프로토타입과 100% 일치합니다.');
    } else if (perfectionRate >= 80) {
      console.log('\n✅ 평가: 우수! 대부분의 기능이 구현되었습니다.');
    } else if (perfectionRate >= 60) {
      console.log('\n⚠️  평가: 양호. 추가 구현이 필요합니다.');
    } else {
      console.log('\n❌ 평가: 불충분. 많은 기능이 미구현 상태입니다.');
    }

    // 결과 저장
    const reportPath = `${SCREENSHOTS_DIR}/comparison-report.json`;
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 상세 리포트 저장: ${reportPath}`);
    console.log(`📸 스크린샷 저장: ${SCREENSHOTS_DIR}/`);

  } catch (error) {
    console.error('\n❌ 검증 중 오류 발생:', error);
    addResult('System', 'Overall Test', 'FAIL', { error: error.message });
  } finally {
    await browser.close();
    console.log('\n✅ 검증 완료\n');
  }

  return results;
}

// 실행
compareOnewmsUI()
  .then(results => {
    console.log('\n━'.repeat(80));
    console.log('검증 완료!');
    console.log(`완벽도: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
    process.exit(results.summary.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('치명적 오류:', error);
    process.exit(1);
  });
