# 라이브커머스 마이그레이션 최종 분석 리포트

**생성일**: 2026-04-06
**분석자**: Claude Code + bkit gap-detector
**원본 시스템**: Google Apps Script v3.4 (성능 최적화판)
**대상 시스템**: Next.js 16 + React 19 + Neon PostgreSQL

---

## 🎯 Executive Summary

### 현재 상태
- **전체 완성도**: 32% (Critical)
- **코드 라인**: 1,444줄 (GAS) → Next.js 마이그레이션 진행 중
- **함수 개수**: 71개 (GAS) → 일부만 구현됨

### 주요 발견사항
1. ✅ **인프라는 준비됨**: Next.js, Prisma, NextAuth 기본 설정 완료
2. ⚠️ **핵심 비즈니스 로직 누락**: Excel 업로드, 통계 대시보드
3. 🔴 **데이터 모델 불일치**: Order 상태 필드 차이
4. 🔴 **보안 이슈**: 역할 기반 데이터 스코핑 없음

### 긴급 조치 필요
1. **P0 (25시간)**: 인증 UI, 스키마 수정, Excel 업로드
2. **P1 (32시간)**: 대시보드, 방송 관리 완성
3. **P2 (21시간)**: AI 기능, 고급 분석

---

## 📊 상세 갭 분석

### 1. 데이터베이스 스키마 분석 (80% 완성)

#### ✅ 구현된 모델
| 모델 | GAS 시트 | Prisma 스키마 | 상태 |
|------|----------|---------------|------|
| User | MEMBER | ✅ | 완료 |
| Product | PRODUCT | ✅ | 완료 |
| Order | 발주 | ⚠️ | 부분 |
| OrderItem | - | ✅ | 완료 |
| Broadcast | 방송일정 | ✅ | 완료 |
| Sale | - | ✅ | 완료 |

#### 🔴 스키마 갭

**Order 모델 불일치**:
```typescript
// Google Sheets 구조 (15개 컬럼)
주문번호, 수령자, 연락처, 주소, 날짜, 상품명, 옵션, 수량,
배송메시지, 입금액, 공급가(개당), 공급가(합계), 마진, 바코드, 주문시간
+ 셀러명, 입금상태, 출고상태 (3개 추가)

// Prisma Order 모델 (누락 필드)
❌ paymentStatus (입금확인전/입금완료)
❌ shippingStatus (대기/발송준비/출고완료/부분출고)
❌ buyer (수령자)
❌ phone (연락처)
❌ address (주소)
❌ deliveryMessage (배송메시지)
```

**User 모델 불일치**:
```typescript
// types/user.ts 선언
channels: string[]      // Prisma 스키마에 없음!
avgSales: number | null // Prisma 스키마에 없음!

// 해결책: Prisma 스키마에 필드 추가 필요
model User {
  ...
  channels   String[]  @default([])
  avgSales   Int?
}
```

**누락 테이블**:
- `ScanLog` - 바코드 스캔 이력
- `OrderHistory` - 발주 상태 변경 로그

### 2. API 엔드포인트 분석 (35% 완성)

#### ✅ 구현된 API

| 엔드포인트 | GAS 함수 | Next.js | 상태 |
|-----------|----------|---------|------|
| `GET /api/users` | getMemberData | ✅ | 완료 |
| `GET /api/products` | getProductList | ✅ | 완료 |
| `GET /api/orders` | getRecentOrderBatches | ✅ | 완료 |
| `GET /api/broadcasts` | getRecentBroadcasts | ✅ | 완료 |
| `GET /api/sales` | - | ✅ | 완료 |

#### 🔴 누락된 API (28개)

**인증 API**:
- ❌ `POST /api/auth/login` → `doLogin(id, pw)`
- ❌ `POST /api/auth/signup` → `doRegister(d)`
- ❌ `GET /api/auth/session` → NextAuth 통합 필요

**발주 관리 API**:
- ❌ `POST /api/orders/upload` → `submitBulkOrder(data)` ⚠️ **가장 중요**
- ❌ `PUT /api/orders/:id/approve` → `updateOrderStatus(...)`
- ❌ `PUT /api/orders/:id/payment` → 입금 상태 변경
- ❌ `PUT /api/orders/:id/shipping` → 출고 상태 변경
- ❌ `POST /api/orders/bulk-update` → `bulkUpdateOrderStatus(...)`
- ❌ `DELETE /api/orders/batch` → `deleteOrderBatch(...)`
- ❌ `GET /api/orders/template` → Excel 양식 다운로드

**바코드 API**:
- ❌ `GET /api/products/barcode/:barcode` → `findByBarcode(bc)`
- ❌ `GET /api/products/code/:code` → `findByCode(c)`

**방송 관리 API**:
- ❌ `POST /api/broadcasts/start` → `startBroadcast(data)`
- ❌ `PUT /api/broadcasts/:id/end` → `endBroadcast(bcCode)`
- ❌ `GET /api/broadcasts/month/:ym` → `getMonthSchedules(...)`
- ❌ `PUT /api/broadcasts/:row/confirm` → `confirmBroadcastSchedule(row)`
- ❌ `PUT /api/broadcasts/:row/cancel` → `cancelBroadcastSchedule(row)`

**통계 API**:
- ❌ `GET /api/stats/performance` → `getPerformanceData(...)`
- ❌ `GET /api/stats/admin-dashboard` → `getAdminDashboard()`
- ❌ `GET /api/stats/seller-analytics` → `getSellerAnalytics(...)`
- ❌ `GET /api/stats/seller/:name` → `getSellerStats(sn)`

**AI 분석 API** (Phase 2):
- ❌ `GET /api/ai/sales-points/:barcode` → `getAISalesPoints(...)`
- ❌ `GET /api/ai/naver-shopping/:query` → `searchNaverShopping(query)`

**사용자 관리 API**:
- ❌ `GET /api/users/my-sellers` → `getMySellers(adminNameOrId)`
- ❌ `GET /api/users/seller/:name/profile` → `getSellerProfileAndStats(...)`
- ❌ `PUT /api/users/:id/profile` → `updateSellerProfile(...)`

### 3. UI 기능 분석 (25% 완성)

#### ✅ 구현된 페이지

| 페이지 | 경로 | GAS 기능 | 상태 |
|--------|------|----------|------|
| 바코드 스캔 | `/barcode` | 검색 폼 | ✅ 기본 |
| 발주 목록 | `/orders` | 목록 표시 | ✅ 기본 |
| 방송 목록 | `/broadcasts` | 목록 표시 | ✅ 기본 |
| 판매 목록 | `/sales` | 목록 표시 | ✅ 기본 |

#### 🔴 누락된 UI (20개 페이지)

**인증 페이지**:
- ❌ `/login` - 로그인
- ❌ `/signup` - 회원가입
- ❌ `/password-reset` - 비밀번호 재설정

**발주 관리 페이지**:
- ❌ `/orders/upload` - Excel 업로드 ⚠️ **가장 중요**
- ❌ `/orders/new` - 신규 발주 폼
- ❌ `/orders/[id]` - 발주 상세/수정
- ❌ `/orders/template` - 양식 다운로드

**바코드 페이지**:
- ❌ 스캔 이력 표시
- ❌ 주문 패드 (장바구니)
- ❌ 주문 패드 → Excel 다운로드

**방송 관리 페이지**:
- ❌ `/broadcasts/new` - 방송 등록 폼
- ❌ `/broadcasts/[id]` - 방송 상세
- ❌ `/broadcasts/calendar` - 달력 뷰
- ❌ `/broadcasts/stats` - 플랫폼별 통계

**통계 대시보드**:
- ❌ `/dashboard` - 메인 대시보드
- ❌ `/dashboard/admin` - 관리자 대시보드
- ❌ `/dashboard/seller` - 셀러 대시보드
- ❌ `/analytics` - 상세 분석

**사용자 관리**:
- ❌ `/users` - 사용자 목록
- ❌ `/users/[id]` - 사용자 상세
- ❌ `/users/my-sellers` - 내 셀러 관리

#### 🔴 누락된 UI 컴포넌트

**발주 관련**:
- ExcelUploader - 파일 업로드 + 검증
- OrderPreview - 업로드 미리보기
- PaymentStatusBadge - 입금 상태 표시
- ShippingStatusBadge - 출고 상태 표시

**바코드 관련**:
- ScanHistory - 최근 스캔 이력
- OrderPad - 주문 임시 저장
- ProductMargin - 마진율 계산 표시

**통계 관련**:
- StatCard - KPI 카드
- SalesChart - 매출 추이 차트 (Recharts)
- RankingTable - 셀러/상품 랭킹
- PlatformPieChart - 플랫폼별 비중

**방송 관련**:
- BroadcastCalendar - 월간 달력 (react-big-calendar)
- BroadcastTimer - 방송 타이머
- BroadcastControls - 시작/종료 버튼

### 4. 비즈니스 로직 분석 (20% 완성)

#### 🔴 누락된 핵심 로직

**Excel 파싱 로직** (submitBulkOrder):
```javascript
// GAS 코드 (line 402-470)
// - 유연한 컬럼명 매핑 (15개 가능한 이름)
// - 바코드로 공급가 자동 조회
// - 통계 계산 (총액, 마진, 공급가)
// - 캐시 무효화
// - 에러 핸들링

// Next.js: 구현 필요
// 1. xlsx 라이브러리 사용
// 2. 컬럼 자동 감지
// 3. 상품코드 검증
// 4. 미리보기 생성
```

**역할 기반 데이터 필터링**:
```javascript
// GAS 코드 (getRecentOrderBatches, line 476)
if(role === '셀러') {
  // 본인 데이터만
} else if(role === '관리자') {
  // 소속 셀러 데이터만
} else if(role === '마스터' || role === '부마스터') {
  // 전체 데이터
}

// Next.js: CRUD 핸들러 수정 필요
// - whereClause에 역할별 필터 추가
// - Prisma query에 적용
```

**캐시 최적화**:
```javascript
// GAS 코드
cacheSet('orders_all', data, 30);    // 30초
cacheSet('members', data, 300);      // 300초
cacheSet('ai6_'+barcode, result, 3600); // 1시간

// Next.js: 구현 방법 검토
// - Redis (권장)
// - Next.js unstable_cache
// - SWR 클라이언트 캐싱
```

**통계 계산 로직** (getPerformanceData, line 669):
```javascript
// GAS 코드
// - 기간별 매출 집계
// - 셀러별 성과 계산
// - 플랫폼별 분석
// - 상품별 판매 순위

// Next.js: Prisma aggregation 사용
// - groupBy, count, sum, avg
// - 복잡한 조인 쿼리
```

### 5. 보안 이슈 분석

#### 🔴 Critical 보안 문제

**1. 역할 기반 접근 제어 미구현**:
```typescript
// 현재 상태 (lib/api/create-crud-handler-prisma.ts)
const data = await prisma[model].findMany({
  // 모든 데이터 반환 (역할 무관!)
});

// 필요한 구현
const data = await prisma[model].findMany({
  where: getRoleBasedFilter(session, model),
  // 역할에 따라 필터링
});
```

**2. 하드코딩된 슈퍼 계정**:
```javascript
// GAS 코드 (line 369)
if(iid==='super'&&ipw==='mujin')
  return{ok:true,user:{id:'super',name:'슈퍼무진',role:'마스터'}};

// 해결책: 환경 변수로 이동
if(id === process.env.SUPER_USER && pw === process.env.SUPER_PASSWORD)
```

**3. 비밀번호 평문 저장**:
```javascript
// GAS 코드: Google Sheets에 평문 저장
// Next.js: bcrypt 해싱 사용 ✅ (이미 구현됨)
```

---

## ⏱️ 마이그레이션 로드맵

### Phase 1: P0 - Critical (25시간, 3일)

**Day 1: 인증 및 스키마 수정 (8시간)**
- [ ] Prisma 스키마 수정 (2시간)
  - Order 모델: paymentStatus, shippingStatus, buyer, phone, address 추가
  - User 모델: channels, avgSales 추가
  - ScanLog 테이블 추가
- [ ] 로그인 페이지 구현 (3시간)
  - `app/(auth)/login/page.tsx`
  - NextAuth 통합
- [ ] 회원가입 페이지 구현 (3시간)
  - `app/(auth)/signup/page.tsx`
  - 역할 선택, 소속 관리자 선택

**Day 2: Excel 업로드 (9시간)**
- [ ] Excel 파싱 로직 (4시간)
  - `lib/utils/excel-parser.ts`
  - xlsx 라이브러리
  - 유연한 컬럼 매핑
- [ ] Excel 업로드 API (2시간)
  - `app/api/orders/upload/route.ts`
  - 상품코드 검증
  - 통계 계산
- [ ] Excel 업로드 UI (3시간)
  - `app/(main)/orders/upload/page.tsx`
  - 미리보기 테이블
  - 에러 표시

**Day 3: 발주 승인 및 역할 기반 필터링 (8시간)**
- [ ] 발주 상태 관리 API (3시간)
  - `PUT /api/orders/:id/approve`
  - `PUT /api/orders/:id/payment`
  - `PUT /api/orders/:id/shipping`
- [ ] 역할 기반 데이터 스코핑 (3시간)
  - CRUD 핸들러 수정
  - Prisma 쿼리 필터
- [ ] 발주 상태 UI (2시간)
  - PaymentStatusBadge
  - ShippingStatusBadge
  - 상태 변경 버튼

**P0 완료 기준**:
- ✅ 로그인/회원가입 가능
- ✅ Excel 발주 업로드 성공
- ✅ 역할별 데이터 필터링 동작
- ✅ 발주 승인/거절 가능

---

### Phase 2: P1 - High Priority (32시간, 4일)

**Day 4: 바코드 및 상품 관리 (8시간)**
- [ ] 바코드 전용 API (2시간)
  - `GET /api/products/barcode/:barcode`
  - 마진율 계산 포함
- [ ] 스캔 이력 기능 (3시간)
  - ScanLog 저장
  - 최근 이력 표시
- [ ] 주문 패드 (3시간)
  - localStorage 저장
  - Excel 다운로드

**Day 5-6: 통계 대시보드 (16시간)**
- [ ] KPI 카드 컴포넌트 (4시간)
  - StatCard
  - 총 매출, 건수, 평균 단가
- [ ] 통계 API (6시간)
  - `GET /api/stats/performance`
  - Prisma aggregation
  - 기간별 필터
- [ ] 차트 통합 (4시간)
  - Recharts LineChart (매출 추이)
  - Recharts PieChart (플랫폼별)
- [ ] 대시보드 페이지 (2시간)
  - `/dashboard`
  - 역할별 뷰

**Day 7: 방송 관리 완성 (8시간)**
- [ ] 방송 시작/종료 API (2시간)
  - `POST /api/broadcasts/start`
  - `PUT /api/broadcasts/:id/end`
- [ ] 방송 등록 폼 (3시간)
  - `/broadcasts/new`
  - 플랫폼 선택
- [ ] 달력 뷰 (3시간)
  - react-big-calendar
  - 월간 일정 표시

**P1 완료 기준**:
- ✅ 바코드 조회 최적화
- ✅ 통계 대시보드 동작
- ✅ 방송 시작/종료 가능
- ✅ 달력에서 일정 확인

---

### Phase 3: P2 - Enhancement (21시간, 3일)

**Day 8: 사용자 관리 (7시간)**
- [ ] 사용자 목록 페이지 (3시간)
- [ ] 사용자 프로필 수정 (2시간)
- [ ] 내 셀러 관리 (2시간)

**Day 9: 고급 분석 (7시간)**
- [ ] 셀러 랭킹 (3시간)
- [ ] 상품 판매 순위 (2시간)
- [ ] 성과 비교 (2시간)

**Day 10: AI 기능 (7시간)**
- [ ] OpenAI/Gemini API 통합 (3시간)
- [ ] AI 판매 포인트 생성 (2시간)
- [ ] 네이버 쇼핑 시세 조회 (2시간)

**P2 완료 기준**:
- ✅ 사용자 관리 가능
- ✅ 랭킹 및 순위 표시
- ✅ AI 분석 기능 동작

---

## 📋 우선순위별 체크리스트

### 🔴 P0 - Must Have (25시간)

**스키마 수정**:
- [ ] Order: paymentStatus, shippingStatus, buyer, phone, address 추가
- [ ] User: channels, avgSales 추가
- [ ] ScanLog 테이블 생성
- [ ] Prisma migration 실행

**인증 UI**:
- [ ] `/login` 페이지
- [ ] `/signup` 페이지
- [ ] NextAuth 통합

**Excel 업로드**:
- [ ] `lib/utils/excel-parser.ts` - 파싱 로직
- [ ] `POST /api/orders/upload` - 업로드 API
- [ ] `/orders/upload` - 업로드 페이지
- [ ] 상품코드 자동 검증

**발주 승인 워크플로우**:
- [ ] `PUT /api/orders/:id/approve` - 승인 API
- [ ] `PUT /api/orders/:id/payment` - 입금 상태 API
- [ ] `PUT /api/orders/:id/shipping` - 출고 상태 API
- [ ] PaymentStatusBadge 컴포넌트
- [ ] ShippingStatusBadge 컴포넌트

**역할 기반 필터링**:
- [ ] CRUD 핸들러 수정 (getRoleBasedFilter)
- [ ] Prisma 쿼리 적용
- [ ] 테스트 (셀러/관리자/마스터별)

### ⚠️ P1 - Should Have (32시간)

**바코드 기능**:
- [ ] `GET /api/products/barcode/:barcode`
- [ ] 마진율 계산 로직
- [ ] 스캔 이력 저장
- [ ] 주문 패드 기능

**통계 대시보드**:
- [ ] `GET /api/stats/performance`
- [ ] StatCard 컴포넌트 (KPI)
- [ ] SalesChart 컴포넌트 (Recharts)
- [ ] `/dashboard` 페이지

**방송 관리**:
- [ ] `POST /api/broadcasts/start`
- [ ] `PUT /api/broadcasts/:id/end`
- [ ] `/broadcasts/new` 폼
- [ ] BroadcastCalendar (react-big-calendar)

**발주서 양식**:
- [ ] `GET /api/orders/template`
- [ ] Excel 템플릿 다운로드

### 🟢 P2 - Nice to Have (21시간)

**사용자 관리**:
- [ ] `/users` - 사용자 목록
- [ ] `/users/[id]` - 프로필 수정
- [ ] `/users/my-sellers` - 내 셀러

**고급 분석**:
- [ ] 셀러 랭킹 (Top 10)
- [ ] 상품 판매 순위
- [ ] 성과 비교 차트

**AI 기능** (Phase 2):
- [ ] `GET /api/ai/sales-points/:barcode`
- [ ] OpenAI/Gemini API 통합
- [ ] 네이버 쇼핑 시세 조회

---

## 🎓 기술 부채 및 개선 사항

### 코드 품질
1. **타입 안정성**:
   - types/ 디렉토리의 타입 정의와 Prisma 스키마 동기화
   - Zod 스키마 자동 생성 (prisma-zod-generator)

2. **에러 핸들링**:
   - 전역 에러 핸들러 구현
   - 에러 바운더리 추가

3. **테스팅**:
   - Unit tests (Vitest)
   - Integration tests (Playwright)
   - E2E tests (발주 워크플로우)

### 성능 최적화
1. **캐싱 전략**:
   - Redis 통합 (Upstash 또는 로컬)
   - SWR 클라이언트 캐싱
   - API Response 캐싱

2. **데이터베이스**:
   - Prisma 인덱스 최적화
   - Connection pooling 설정
   - N+1 쿼리 방지

3. **프론트엔드**:
   - 이미지 최적화 (next/image)
   - Code splitting
   - React.memo 사용

### 보안 강화
1. **환경 변수**:
   - 슈퍼 계정 정보 환경 변수화
   - API 키 관리 (OpenAI, Gemini)

2. **RBAC 강화**:
   - Middleware 기반 권한 체크
   - API 레벨 검증

3. **로깅**:
   - 사용자 활동 로그
   - 보안 이벤트 모니터링

---

## 📌 결론

### 현재 상태
- **인프라**: ✅ 준비 완료 (Next.js, Prisma, NextAuth)
- **기본 CRUD**: ✅ 동작함 (User, Product, Order, Broadcast, Sale)
- **핵심 비즈니스 로직**: 🔴 누락 (Excel 업로드, 통계, AI)
- **보안**: ⚠️ 역할 기반 필터링 필요

### 긴급 조치 필요
1. **P0 (25시간)**: 인증 UI + Excel 업로드 + 역할 필터링
2. **P1 (32시간)**: 대시보드 + 방송 관리
3. **P2 (21시간)**: AI 기능 + 고급 분석

### 예상 총 작업 시간
- **P0**: 25시간 (3일)
- **P1**: 32시간 (4일)
- **P2**: 21시간 (3일)
- **총합**: **78시간 (10일)**

### 추천 일정
- **Week 1**: P0 완료 (3일) + P1 시작 (2일)
- **Week 2**: P1 완료 (2일) + P2 완료 (3일)

---

**작성자**: Claude Code + bkit gap-detector
**분석 완료일**: 2026-04-06
**다음 단계**: P0 작업 시작 (인증 UI + Excel 업로드)
