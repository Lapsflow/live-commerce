# Google Apps Script 함수 목록 (v3.4)

**총 함수 수**: 71개
**총 라인 수**: 1,444줄
**분석일**: 2026-04-06

---

## 📋 기능별 함수 분류

### 1️⃣ 인증 및 사용자 관리 (13개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `doLogin(id, pw)` | 363 | 로그인 처리 |
| `doRegister(d)` | 1119 | 회원가입 |
| `fixAdminNames()` | 6 | 관리자 이름 수정 |
| `getMemberData()` | 288 | 회원 데이터 조회 |
| `getMemberMap()` | 304 | 회원 맵 생성 |
| `invalidateMemberCache()` | 318 | 회원 캐시 무효화 |
| `getMySellers(adminNameOrId)` | 727 | 내 셀러 목록 |
| `getSellersByAdmin(adminName)` | 755 | 관리자별 셀러 |
| `getAllSellers()` | 775 | 전체 셀러 목록 |
| `updateSellerProfile(userId, channels, avgSales)` | 1130 | 셀러 프로필 수정 |
| `getSellerProfileAndStats(sellerName)` | 792 | 셀러 프로필 및 통계 |
| `getAdminList()` | 1145 | 관리자 목록 |
| `setupMemberDropdown()` | 1156 | 회원 드롭다운 설정 |

### 2️⃣ 발주 관리 (14개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `submitBulkOrder(data)` | 402 | 대량 발주 제출 |
| `getRecentOrderBatches(role, userName)` | 476 | 최근 발주 배치 |
| `getOrdersByDate(date)` | 534 | 날짜별 발주 조회 |
| `updateSingleOrderStatus(row, field, value)` | 553 | 단일 발주 상태 변경 |
| `updateOrderStatus(orderId, statusType, value)` | 573 | 발주 상태 변경 |
| `bulkUpdateOrderStatus(date, field, value)` | 592 | 일괄 상태 변경 |
| `getSellerOrderHistory(sellerName)` | 616 | 셀러 발주 이력 |
| `deleteOrderBatch(date, seller)` | 641 | 발주 배치 삭제 |
| `resetOrderHistory()` | 656 | 발주 이력 초기화 |
| `initOrderHeaders(ws)` | 327 | 발주 헤더 초기화 |
| `resetAndInitOrders()` | 351 | 발주 시트 리셋 |
| `getOrderDataFast()` | 258 | 발주 데이터 고속 조회 (캐시) |
| `invalidateOrderCache()` | 277 | 발주 캐시 무효화 |
| `getShipColor(st)` | 567 | 배송 상태 색상 |

### 3️⃣ 바코드 및 상품 관리 (4개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `getProductList()` | 1175 | 상품 목록 조회 |
| `findByBarcode(bc)` | 1210 | 바코드로 상품 찾기 |
| `findByCode(c)` | 1211 | 상품코드로 찾기 |
| `normBarcode(v)` | 1169 | 바코드 정규화 |

### 4️⃣ 방송 관리 (9개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `startBroadcast(data)` | 1243 | 방송 시작 |
| `endBroadcast(bcCode)` | 1254 | 방송 종료 |
| `getRecentBroadcasts(sellerName)` | 1264 | 최근 방송 목록 |
| `addBroadcastSchedule(...)` | 1278 | 방송 일정 추가 |
| `getMonthSchedules(ym, role, name)` | 1289 | 월간 방송 일정 |
| `confirmBroadcastSchedule(row)` | 1305 | 방송 일정 확정 |
| `cancelBroadcastSchedule(row)` | 1306 | 방송 일정 취소 |
| `changeBroadcastSchedule(...)` | 1307 | 방송 일정 변경 |
| `changeBroadcastDate(row, nd)` | 1308 | 방송 날짜 변경 |

### 5️⃣ 통계 및 대시보드 (7개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `getPerformanceData(role, name, fromDate, toDate)` | 669 | 성과 데이터 |
| `getAdminDashboard()` | 859 | 관리자 대시보드 |
| `getAdminDetail(adminName)` | 935 | 관리자 상세 |
| `getMySellersDashboard(adminName)` | 980 | 내 셀러 대시보드 |
| `getSellerAnalytics(role, name)` | 1062 | 셀러 분석 |
| `getSellerStats(sn)` | 1213 | 셀러 통계 |
| `debugAdminMapping()` | 833 | 관리자 매핑 디버그 |

### 6️⃣ AI 및 시장 분석 (5개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `getAISalesPoints(barcode, name, sale, supply)` | 1314 | AI 판매 포인트 생성 |
| `callOpenAI(prompt)` | 1326 | OpenAI API 호출 |
| `callGemini(prompt)` | 1340 | Gemini API 호출 |
| `buildLocalAnalysis(name, sale, supply)` | 1351 | 로컬 분석 |
| `searchNaverShopping(query)` | 1365 | 네이버 쇼핑 시세 조회 |

### 7️⃣ 캐시 및 성능 최적화 (3개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `cacheSet(key, value, sec)` | 237 | 캐시 저장 |
| `cacheGet(key)` | 241 | 캐시 조회 |
| `cacheDelete(key)` | 248 | 캐시 삭제 |

### 8️⃣ 유틸리티 및 헬퍼 (10개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `getSS()` | 182 | 스프레드시트 가져오기 |
| `buildHeaderMap(h)` | 188 | 헤더 맵 생성 |
| `hGet(row, hm, col, def)` | 193 | 헤더 기반 값 가져오기 |
| `hNum(row, hm, col)` | 200 | 숫자 값 가져오기 |
| `hStr(row, hm, col)` | 201 | 문자열 값 가져오기 |
| `hDate(row, hm, col)` | 202 | 날짜 값 가져오기 |
| `_normVal(v)` | 702 | 값 정규화 |
| `_resolveRole(s)` | 706 | 역할 해석 |
| `_buildSellerObj(r)` | 718 | 셀러 객체 생성 |
| `fmt(n)` | 1420 | 숫자 포맷 |
| `formatDateKorean(dateStr)` | 1422 | 날짜 한글 포맷 |

### 9️⃣ 웹 앱 진입점 (2개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `doGet(e)` | 23 | HTTP GET 처리 (메인 진입점) |
| `buildJsPatch()` | 37 | JavaScript 패치 빌드 |

### 🔟 기타 (4개)

| 함수명 | 라인 | 기능 |
|--------|------|------|
| `initialSetup()` | 1382 | 초기 설정 |
| `submitProposal(data)` | 1396 | 제안서 제출 |
| `getProposals()` | 1407 | 제안서 목록 |

---

## 🔍 주요 발견 사항

### ✅ 구현된 핵심 기능

1. **완전한 인증 시스템** (로그인, 회원가입, 역할 관리)
2. **발주 관리 전체** (Excel 업로드, 승인/거절, 상태 관리)
3. **방송 관리 전체** (시작/종료, 일정 관리)
4. **통계 대시보드** (관리자, 셀러별 성과)
5. **AI 분석 기능** (OpenAI, Gemini, 네이버 시세)
6. **캐시 최적화** (30초~300초 캐시)

### ⚠️ Next.js에 누락된 기능

1. **AI 기능 전체** (getAISalesPoints, callOpenAI, callGemini, searchNaverShopping)
2. **통계 대시보드** (getAdminDashboard, getSellerAnalytics)
3. **방송 상태 관리** (startBroadcast, endBroadcast)
4. **Excel 다운로드** (downloadOrderTemplate, downloadOrderPad - 프론트 JS로 구현)
5. **일괄 상태 변경** (bulkUpdateOrderStatus)

### 🎯 데이터 구조 (Google Sheets)

Apps Script는 다음 시트를 사용:
- **MEMBER** - 회원 정보
- **PRODUCT** - 상품 정보
- **발주** - 발주 내역
- **방송일정** - 방송 스케줄
- (추가 시트 확인 필요)

---

**다음 단계**: 각 함수의 상세 로직 분석 및 Next.js 마이그레이션 갭 분석
