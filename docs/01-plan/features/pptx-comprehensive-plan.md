# 프로그램정보 수정건.pptx 전체 스펙 종합 계획

## 문서 개요

**목적**: pptx 문서의 모든 기능과 현재 구현을 페이즈별로 비교하여 100% 일치 달성

**참고 파일**: `/Users/jinwoo/Downloads/프로그램정보 수정건.pptx`

**작성일**: 2026-04-09

---

## Phase 1: 회원가입 및 인증 시스템

### pptx 스펙

#### 1차 필수 입력 정보 (5개)
- ✅ 아이디 (username)
- ✅ 비밀번호
- ✅ 이름
- ✅ 휴대폰번호 (필수)
- ✅ 소속관리자/센터명

#### 센터 코드 형식
```
[지역코드 01-17]-[센터 대표자 휴대폰 뒷 4자리]
예: 01-4213, 02-3413, 14-6521
```
- ✅ 구현됨: `lib/validators/center.ts`에 검증 로직 존재
- ⚠️ 확인 필요: 센터 생성 API에서 실제로 검증하는지 확인

#### 2차 추가 정보 (선택, 가입 후 입력)
- ✅ 방송 채널 (channels)
- ✅ 월 평균 방송 매출 (avgSales)
- ✅ 주요 판매 카테고리 (categories)
- ✅ 활동 지역 (regions)
- ✅ 방송 가능 시간대 (timeSlots)

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model User {
  username     String   @unique  // ✅ pptx 스펙 준수
  email        String?  @unique  // ✅ 선택 필드
  phone        String             // ✅ 필수 필드
  channels     String[] @default([])
  avgSales     Int?
  categories   String[] @default([])
  regions      String[] @default([])
  timeSlots    String[] @default([])
}
```

**API 엔드포인트**:
- ✅ `POST /api/auth/signup` - 회원가입
- ✅ `PATCH /api/users/[id]/profile` - 프로필 업데이트

**UI 페이지**:
- ✅ `app/(auth)/signup/page.tsx` - 회원가입 페이지
- ✅ `app/(main)/profile/complete/page.tsx` - 프로필 완성 페이지

### Gap Analysis

**✅ 완료된 항목**:
1. username 필드 추가 (로그인용 아이디)
2. email 선택 필드로 변경
3. phone 필수 필드로 변경
4. categories, regions, timeSlots 필드 추가
5. 프로필 완성 페이지 구현

**⚠️ 확인 필요**:
1. 센터 코드 형식 검증이 실제로 작동하는지 테스트
2. 프로필 완성 페이지가 회원가입 후 자동으로 안내되는지 확인

---

## Phase 2: 바코드 스캔 및 AI 분석

### pptx 스펙

**핵심 요구사항**:
- ❌ **바코드를 찍으면 자동으로 AI 분석 실행**
- ❌ **미리 입력해둔 프롬프트에 따라 상품 경쟁력 분석 자동 생성**

### 현재 구현 상태

**페이지**: `app/(main)/inventory/barcode/page.tsx`
- ✅ 바코드 스캔 UI 존재
- ✅ LOOKUP/INBOUND/OUTBOUND 모드 지원
- ✅ 스캔 이력 조회 기능

**AI 분석 API**: `app/api/ai/analyze/route.ts`
- ✅ POST 요청으로 AI 분석 실행
- ✅ Rate limit: 10회/시간
- ✅ Redis 캐싱 지원

**UI 컴포넌트**: `app/(main)/inventory/barcode/components/AIInsightsCard.tsx`
- ❌ **"AI 분석 시작" 버튼 클릭 필요** (수동 트리거)
- ❌ **바코드 스캔 시 자동 실행 안 됨** (pptx 요구사항 미준수)

### Gap Analysis

**🔴 Critical Gap**:
1. **GAP-1 (P0)**: AI 분석이 수동 버튼 클릭 방식
   - pptx 요구: 바코드 스캔 즉시 자동 실행
   - 현재 구현: "AI 분석 시작" 버튼 클릭 후 실행
   - 영향: 사용자 경험이 pptx 스펙과 완전히 다름

**수정 계획**:
1. `useAIAnalysis.ts` hook을 `useMutation` → `useQuery`로 변경
2. 바코드 스캔 완료 시 자동으로 AI 분석 호출
3. "AI 분석 시작" 버튼 제거
4. 분석 결과를 기본 펼침 상태로 표시

---

## Phase 3: 상품 관리

### pptx 스펙

**확인 필요**: pptx에서 상품 관리 요구사항 명시 여부

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model Product {
  code        String   @unique
  name        String
  barcode     String   @unique
  sellPrice   Int
  supplyPrice Int
  totalStock  Int
  onewmsCode  String?  @unique
  productType ProductType @default(HEADQUARTERS)
  managedBy   String?  // centerId
}
```

**API 엔드포인트**:
- ✅ `GET /api/products` - 상품 목록 조회
- ✅ `POST /api/products` - 상품 생성
- ✅ `GET /api/products/barcode/[code]` - 바코드로 상품 조회
- ✅ `GET /api/products/[id]` - 상품 상세 조회
- ✅ `PATCH /api/products/[id]` - 상품 수정
- ✅ `DELETE /api/products/[id]` - 상품 삭제

**UI 페이지**:
- ✅ `app/(main)/products/page.tsx` - 상품 목록
- ✅ `app/(main)/products/new/page.tsx` - 상품 등록
- ✅ `app/(main)/products/[id]/page.tsx` - 상품 상세

### Gap Analysis

**⚠️ pptx 확인 필요**: 상품 관리 기능의 pptx 스펙 존재 여부

---

## Phase 4: 재고 관리 및 ONEWMS 연동

### pptx 스펙

**확인 필요**: pptx에서 재고 관리/ONEWMS 연동 요구사항 명시 여부

### 현재 구현 상태

**ONEWMS 연동 API**:
- ✅ `POST /api/onewms/stock/sync` - 재고 동기화
- ✅ `GET /api/onewms/stock/[productId]` - 재고 조회
- ✅ `GET /api/onewms/stock/conflicts` - 재고 충돌 조회
- ✅ `POST /api/onewms/stock/conflicts/[id]/resolve` - 충돌 해결
- ✅ `POST /api/onewms/orders/sync` - 주문 동기화
- ✅ `POST /api/onewms/orders/retry` - 주문 재시도
- ✅ `PATCH /api/onewms/orders/[id]/status` - 주문 상태 업데이트
- ✅ `POST /api/onewms/delivery/update` - 배송 정보 업데이트
- ✅ `GET /api/onewms/delivery/invoice/[transNo]` - 송장 조회
- ✅ `GET /api/onewms/stats` - ONEWMS 통계

**UI 페이지**:
- ✅ `app/dashboard/onewms/page.tsx` - ONEWMS 대시보드

### Gap Analysis

**⚠️ pptx 확인 필요**: ONEWMS 연동 기능의 pptx 스펙 존재 여부

---

## Phase 5: 주문 관리

### pptx 스펙

**확인 필요**: pptx에서 주문 관리 요구사항 명시 여부

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model Order {
  productCode       String
  quantity          Int
  unitPrice         Int
  totalPrice        Int
  sellerId          String
  adminId           String?
  broadcastId       String?
  status            OrderStatus @default(PENDING)
  onewmsOrderId     String?     @unique
  onewmsTransNo     String?
}
```

**API 엔드포인트**:
- ✅ `GET /api/orders` - 주문 목록 조회
- ✅ `POST /api/orders` - 주문 생성
- ✅ `GET /api/orders/[id]` - 주문 상세 조회
- ✅ `PATCH /api/orders/[id]` - 주문 수정
- ✅ `DELETE /api/orders/[id]` - 주문 삭제
- ✅ `POST /api/orders/bulk` - 대량 주문 생성
- ✅ `GET /api/orders/bulk-status` - 대량 주문 상태 조회
- ✅ `POST /api/orders/template` - 주문 템플릿
- ✅ `GET /api/orders/export` - 주문 내보내기

**UI 페이지**:
- ✅ `app/(main)/orders/page.tsx` - 주문 목록
- ✅ `app/(main)/orders/[id]/page.tsx` - 주문 상세
- ✅ `app/(main)/orders/upload/page.tsx` - 주문 업로드

### Gap Analysis

**⚠️ pptx 확인 필요**: 주문 관리 기능의 pptx 스펙 존재 여부

---

## Phase 6: 방송 관리

### pptx 스펙

**확인 필요**: pptx에서 방송 관리 요구사항 명시 여부

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model Broadcast {
  title             String
  scheduledAt       DateTime
  startedAt         DateTime?
  endedAt           DateTime?
  status            BroadcastStatus @default(SCHEDULED)
  sellerId          String
  centerId          String
  targetSales       Int?
  actualSales       Int?
  viewerCount       Int?
}
```

**API 엔드포인트**:
- ✅ `GET /api/broadcasts` - 방송 목록 조회
- ✅ `POST /api/broadcasts` - 방송 생성
- ✅ `GET /api/broadcasts/[id]` - 방송 상세 조회
- ✅ `PATCH /api/broadcasts/[id]` - 방송 수정
- ✅ `DELETE /api/broadcasts/[id]` - 방송 삭제
- ✅ `POST /api/broadcasts/[id]/start` - 방송 시작
- ✅ `POST /api/broadcasts/[id]/end` - 방송 종료
- ✅ `POST /api/broadcasts/[id]/confirm` - 방송 확정
- ✅ `POST /api/broadcasts/[id]/cancel` - 방송 취소
- ✅ `GET /api/broadcasts/[id]/stats` - 방송 통계
- ✅ `GET /api/broadcasts/month/[ym]` - 월별 방송
- ✅ `POST /api/broadcasts/lookup-center` - 센터 조회

**UI 페이지**:
- ✅ `app/(main)/broadcasts/page.tsx` - 방송 목록
- ✅ `app/(main)/broadcasts/calendar/page.tsx` - 방송 캘린더

### Gap Analysis

**⚠️ pptx 확인 필요**: 방송 관리 기능의 pptx 스펙 존재 여부

---

## Phase 7: 매출 관리

### pptx 스펙

**확인 필요**: pptx에서 매출 관리 요구사항 명시 여부

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model Sale {
  productCode   String
  quantity      Int
  unitPrice     Int
  totalAmount   Int
  soldAt        DateTime
  sellerId      String
  broadcastId   String?
}
```

**API 엔드포인트**:
- ✅ `GET /api/sales` - 매출 목록 조회
- ✅ `POST /api/sales` - 매출 생성
- ✅ `GET /api/sales/[id]` - 매출 상세 조회

**UI 페이지**:
- ✅ `app/(main)/sales/page.tsx` - 매출 관리

### Gap Analysis

**⚠️ pptx 확인 필요**: 매출 관리 기능의 pptx 스펙 존재 여부

---

## Phase 8: 센터 관리 (ADMIN/MASTER 전용)

### pptx 스펙

**핵심 요구사항**:
- ✅ 센터 코드 형식: `[지역코드 01-17]-[휴대폰 뒷 4자리]`
- ✅ 모든 계정은 센터에 소속되어야 함
- ✅ 센터 미소속 시 방송 불가
- ✅ 센터별 소속 셀러의 매출/주문 이력 조회

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model Center {
  code         String   @unique
  name         String
  regionCode   String
  address      String?
  phone        String?
  managerName  String?
  status       CenterStatus @default(ACTIVE)
}
```

**API 엔드포인트**:
- ✅ `GET /api/centers` - 센터 목록 조회
- ✅ `POST /api/centers` - 센터 생성
- ✅ `GET /api/centers/[id]` - 센터 상세 조회
- ✅ `PATCH /api/centers/[id]` - 센터 수정
- ✅ `DELETE /api/centers/[id]` - 센터 삭제
- ✅ `GET /api/centers/[id]/products` - 센터 상품 조회
- ✅ `GET /api/centers/[id]/users` - 센터 사용자 조회
- ✅ `GET /api/centers/[id]/stats` - 센터 통계
- ✅ `GET /api/centers/check-available` - 센터 코드 중복 확인
- ✅ `POST /api/centers/validate-code` - 센터 코드 검증

**UI 페이지**:
- ✅ `app/(main)/admin/centers/page.tsx` - 센터 목록
- ✅ `app/(main)/admin/centers/new/page.tsx` - 센터 생성
- ✅ `app/(main)/admin/centers/[id]/page.tsx` - 센터 상세
- ✅ `app/(main)/admin/centers/[id]/edit/page.tsx` - 센터 수정
- ✅ `app/(main)/admin/centers/[id]/stats/page.tsx` - 센터 통계

### Gap Analysis

**✅ 완료된 항목**:
1. 센터 코드 검증 로직 구현
2. 센터 관리 UI 구현
3. 센터 통계 기능 구현

**⚠️ 확인 필요**:
1. 센터 미소속 시 방송 불가 로직 구현 여부
2. 센터 코드 검증이 실제로 작동하는지 테스트

---

## Phase 9: 계약 승인 (ADMIN 전용)

### pptx 스펙

**핵심 요구사항**:
- ✅ SELLER 회원가입 후 계약 승인 대기 상태
- ✅ ADMIN이 계약 승인/거절
- ✅ 승인 전에는 로그인 불가

### 현재 구현 상태

**데이터베이스**: `prisma/schema.prisma`
```prisma
model User {
  contractStatus          ContractStatus @default(PENDING)
  contractApprovedAt      DateTime?
  contractApprovedBy      String?
  contractRejectionReason String?
}

enum ContractStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**API 엔드포인트**:
- ✅ `POST /api/admin/contracts/[userId]/approve` - 계약 승인
- ✅ `POST /api/admin/contracts/[userId]/reject` - 계약 거절

**UI 페이지**:
- ✅ `app/(main)/admin/contracts/page.tsx` - 계약 승인 관리

**인증 로직**: `lib/auth.ts`
```typescript
// SELLER 계약 상태 확인
if (user.role === 'SELLER') {
  if (user.contractStatus === 'PENDING') {
    throw new Error('CONTRACT_PENDING');
  }
  if (user.contractStatus === 'REJECTED') {
    throw new Error('CONTRACT_REJECTED');
  }
}
```

### Gap Analysis

**✅ 완료된 항목**:
1. 계약 승인 프로세스 구현
2. 계약 상태 확인 로직 구현
3. 로그인 제한 로직 구현

---

## Phase 10: 기타 기능

### 바코드 마스터 관리

**현재 구현 상태**:
- ✅ `app/(main)/admin/barcode-master/page.tsx` - 바코드 마스터 관리
- ✅ `app/api/barcode-master/route.ts` - 바코드 마스터 API

### 대시보드

**현재 구현 상태**:
- ✅ `app/(main)/dashboard/page.tsx` - 메인 대시보드
- ✅ `app/(main)/admin/dashboard/page.tsx` - ADMIN 대시보드
- ✅ `app/dashboard/onewms/page.tsx` - ONEWMS 대시보드

### 제안서 관리

**현재 구현 상태**:
- ✅ `app/(main)/proposals/page.tsx` - 제안서 관리
- ✅ `app/(main)/samples/cart/page.tsx` - 샘플 카트

### 사용자 관리

**현재 구현 상태**:
- ✅ `app/(main)/users/page.tsx` - 사용자 목록
- ✅ `app/api/users/route.ts` - 사용자 API
- ✅ `app/api/users/[id]/route.ts` - 사용자 상세 API

---

## 종합 Gap 분석 요약

### 🔴 Critical Priority (즉시 수정 필요)

1. **바코드 AI 자동 분석 (Phase 2)**
   - 문제: "AI 분석 시작" 버튼 클릭 방식 (수동)
   - pptx 요구: 바코드 스캔 즉시 자동 실행
   - 수정 필요: `useAIAnalysis.ts`, `AIInsightsCard.tsx`

### 🟡 Important Priority (검증 필요)

1. **센터 코드 검증 (Phase 8)**
   - 로직은 구현되어 있음: `lib/validators/center.ts`
   - 확인 필요: 센터 생성 API에서 실제로 검증하는지 테스트

2. **센터 미소속 시 방송 불가 (Phase 8)**
   - pptx 요구: 센터 미소속 시 방송 불가
   - 확인 필요: 방송 생성 API에서 검증하는지 확인

3. **프로필 완성 안내 (Phase 1)**
   - 확인 필요: 회원가입 후 자동으로 프로필 완성 페이지 안내되는지

### 🟢 Low Priority (pptx 스펙 확인 필요)

다음 기능들에 대한 pptx 스펙 존재 여부 확인 필요:
- 상품 관리 (Phase 3)
- 재고 관리 및 ONEWMS 연동 (Phase 4)
- 주문 관리 (Phase 5)
- 방송 관리 (Phase 6)
- 매출 관리 (Phase 7)
- 바코드 마스터 관리
- 대시보드
- 제안서 관리

---

## 다음 단계

### 1단계: Critical Gap 수정
- [ ] 바코드 AI 자동 분석 구현
  - [ ] `useAIAnalysis.ts` → `useMutation` → `useQuery` 변경
  - [ ] 바코드 스캔 완료 시 자동 호출 로직 추가
  - [ ] "AI 분석 시작" 버튼 제거
  - [ ] 분석 결과 기본 펼침 상태로 변경

### 2단계: Important Priority 검증
- [ ] 센터 코드 검증 테스트
- [ ] 센터 미소속 시 방송 불가 로직 확인
- [ ] 프로필 완성 안내 플로우 확인

### 3단계: pptx 전체 스펙 확인
- [ ] pptx 문서의 전체 내용 확인
- [ ] 각 기능별 요구사항 상세 파악
- [ ] 누락된 기능 식별

### 4단계: 100% 일치 달성
- [ ] 모든 Gap 수정 완료
- [ ] 전체 기능 테스트
- [ ] pptx 스펙 100% 준수 확인

---

## 참고 사항

### pptx 읽기 방법

pptx 파일이 바이너리 형식이라 직접 읽을 수 없습니다. 다음 방법 중 하나로 내용 확인 필요:

1. **PDF로 변환**: PowerPoint에서 PDF로 저장 후 Read tool로 읽기
2. **이미지로 변환**: 각 슬라이드를 이미지로 저장 후 Read tool로 읽기
3. **텍스트 추출**: 슬라이드 내용을 텍스트 파일로 저장
4. **수동 확인**: 사용자가 pptx 내용을 확인하고 필요한 부분 공유

### 현재 계획의 한계

기존 계획 파일(`snoopy-purring-ritchie.md`)에는 **회원가입 기능만** 문서화되어 있습니다.
이 문서는 현재 프로젝트 구현을 역분석하여 작성된 것으로, pptx의 전체 스펙을 완벽하게 반영하지 못할 수 있습니다.

**pptx 전체 내용 확인이 필수적입니다.**
