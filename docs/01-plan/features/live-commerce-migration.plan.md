# Plan: 라이브커머스 관리 시스템 마이그레이션

**Feature**: live-commerce-migration
**Version**: 1.0.0
**Created**: 2026-04-05
**Status**: Planning

---

## 1. 프로젝트 개요

### 1.1 목적
Google Apps Script 기반 라이브커머스 관리 시스템(v2.5)을 Next.js 16 + React 19 + Neon PostgreSQL로 완전 마이그레이션하여 확장성, 성능, 유지보수성을 개선합니다.

### 1.2 배경
**현재 시스템 (v2.5)**
- **기술 스택**: Google Apps Script + Google Sheets
- **주요 기능**: 바코드 스캔, 발주관리, 방송일정, 판매현황, 권한관리
- **제한사항**:
  - Google Sheets 성능 한계 (대용량 데이터 처리 제한)
  - UI/UX 개선 어려움 (GAS UI 제약)
  - 확장성 제한 (서버리스 시간 제한)
  - 타 시스템 연동 복잡

**목표 시스템**
- **기술 스택**: Next.js 16 App Router + React 19 + Neon PostgreSQL + Vercel
- **개선 목표**:
  - 실시간 성능 향상 (바코드 스캔 응답 <100ms)
  - 모던 UI/UX (shadcn/ui, Tailwind CSS 4)
  - 무제한 확장성 (Neon serverless DB)
  - RESTful API 제공 (타 시스템 연동)

### 1.3 범위

**In Scope (포함)**
- ✅ 4대 핵심 기능 완전 마이그레이션
  1. 바코드 스캔 + 재고 조회
  2. 발주 관리 시스템
  3. 방송 일정 + 판매 현황
  4. 사용자/권한 관리 (RBAC)
- ✅ Hyudo ERP 검증된 코드 재사용
  - NextAuth v5 인증 시스템
  - Prisma CRUD API 팩토리
  - DataTable 컴포넌트
  - shadcn/ui 설정
- ✅ 데이터 마이그레이션 (Google Sheets → Neon PostgreSQL)
- ✅ Vercel 프로덕션 배포

**Out of Scope (제외)**
- ❌ AI 기능 (OpenAI/Gemini 분석) — Phase 2로 연기
- ❌ 네이버/쿠팡 시세 조회 — Phase 2로 연기
- ❌ 모바일 앱 개발 — 웹 반응형으로 대체

---

## 2. 이해관계자

| 역할 | 이름 | 책임 |
|------|------|------|
| 프로젝트 오너 | jinwoo | 요구사항 정의, 최종 승인 |
| 개발자 | Claude Code | 풀스택 개발, 마이그레이션 |
| 최종 사용자 | 마스터/부마스터/관리자/셀러 | 시스템 사용, 피드백 |

---

## 3. 요구사항 분석

### 3.1 기능 요구사항

#### FR-01: 사용자 인증 및 권한 관리
**우선순위**: P0 (Critical)

**현재 시스템**
- 로그인/회원가입 기능
- 4단계 역할: 마스터, 부마스터, 관리자, 셀러
- 소속 관리자 선택 (셀러 → 관리자 매핑)

**목표 시스템**
```typescript
// 역할 정의
enum Role {
  MASTER = "MASTER",         // 전체 관리자
  SUB_MASTER = "SUB_MASTER", // 부관리자
  ADMIN = "ADMIN",           // 관리자
  SELLER = "SELLER"          // 셀러
}

// 사용자 스키마
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  phone       String?
  role        Role     @default(SELLER)
  adminId     String?  // 소속 관리자 ID
  admin       User?    @relation("AdminSellers", fields: [adminId], references: [id])
  sellers     User[]   @relation("AdminSellers")
  channels    String[] // 활성 플랫폼 배열
  avgSales    Int?     // 평균 판매액
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**기능 상세**
- NextAuth v5 기반 세션 인증
- bcrypt 비밀번호 해싱
- 역할별 페이지 접근 제어 (withRole HOC)
- 최초 로그인 시 비밀번호 설정

**API 엔드포인트**
- `POST /api/auth/signin` - 로그인
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/setup-password` - 비밀번호 설정
- `GET /api/users/me` - 현재 사용자 정보
- `GET /api/users?role=SELLER` - 역할별 사용자 목록

---

#### FR-02: 바코드 스캔 및 재고 조회
**우선순위**: P0 (Critical)

**현재 시스템**
- 바코드 입력 또는 카메라 스캔
- 상품 정보 실시간 조회 (코드, 이름, 바코드, 가격, 재고)
- 재고 현황: 총재고, 무진재고, 1창고, 2창고, 3창고

**목표 시스템**
```typescript
// 상품 스키마
model Product {
  id           String   @id @default(cuid())
  code         String   @unique  // 상품코드
  name         String              // 상품명
  barcode      String   @unique    // 바코드
  sellPrice    Int                 // 판매가
  supplyPrice  Int                 // 공급가
  totalStock   Int      @default(0) // 총재고
  stockMujin   Int      @default(0) // 무진재고
  stock1       Int      @default(0) // 1창고
  stock2       Int      @default(0) // 2창고
  stock3       Int      @default(0) // 3창고
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**기능 상세**
- 바코드 입력창 (Enter 키 자동 조회)
- 실시간 재고 조회 (응답 시간 <100ms 목표)
- 재고 부족 알림 (총재고 < 10개)
- 최근 조회 이력 (localStorage 캐싱)
- 모바일 카메라 스캔 지원 (Phase 2)

**API 엔드포인트**
- `GET /api/products/search?barcode={barcode}` - 바코드 조회
- `GET /api/products/search?code={code}` - 상품코드 조회
- `GET /api/products?stock=low` - 재고 부족 상품 목록

**UI 컴포넌트**
- `BarcodeScanner` - 바코드 입력/스캔 컴포넌트
- `ProductInfo` - 상품 정보 표시 (사이드바)
- `StockIndicator` - 재고 현황 시각화 (Badge)

---

#### FR-03: 발주 관리 시스템
**우선순위**: P0 (Critical)

**현재 시스템**
- Excel 파일 업로드 (발주서)
- 발주서 양식 제공 (다운로드)
- 발주 내역 조회 (셀러별, 날짜별)
- 발주 상태: 대기, 승인, 거절

**목표 시스템**
```typescript
// 발주 스키마
model Order {
  id          String      @id @default(cuid())
  orderNo     String      @unique  // 발주번호 (자동 생성)
  sellerId    String
  seller      User        @relation(fields: [sellerId], references: [id])
  adminId     String?
  admin       User?       @relation("AdminOrders", fields: [adminId], references: [id])
  status      OrderStatus @default(PENDING)
  items       OrderItem[]
  totalAmount Int         @default(0)
  memo        String?
  uploadedAt  DateTime    @default(now())
  approvedAt  DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

enum OrderStatus {
  PENDING  // 대기
  APPROVED // 승인
  REJECTED // 거절
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  quantity    Int
  unitPrice   Int
  totalPrice  Int      // quantity * unitPrice
  createdAt   DateTime @default(now())
}
```

**기능 상세**
- Excel 파일 업로드 (xlsx, xls)
  - 파일 검증 (필수 컬럼: 상품코드, 수량)
  - 미리보기 (업로드 전 확인)
  - 상품코드 자동 검증 (DB 존재 여부)
- 발주서 양식 다운로드 (Excel 템플릿)
- 발주 내역 조회
  - 셀러: 본인 발주만 조회
  - 관리자: 소속 셀러 발주 조회
  - 마스터: 전체 발주 조회
- 발주 승인/거절 (관리자 이상)
- 발주 통계 (총 금액, 건수)

**API 엔드포인트**
- `POST /api/orders/upload` - Excel 발주서 업로드
- `GET /api/orders` - 발주 내역 조회 (필터: status, sellerId, date)
- `PUT /api/orders/:id/approve` - 발주 승인
- `PUT /api/orders/:id/reject` - 발주 거절
- `GET /api/orders/template` - 발주서 양식 다운로드

**UI 컴포넌트**
- `OrderUpload` - Excel 업로드 + 미리보기
- `OrderTable` - DataTable (정렬, 필터, 페이지네이션)
- `OrderStatusBadge` - 상태 표시 Badge

---

#### FR-04: 방송 일정 관리
**우선순위**: P1 (High)

**현재 시스템**
- 플랫폼 선택: 그립, 클메, 유튜브, 틱톡, 밴드, 기타
- 방송 시작/종료 기록
- 달력 기반 방송 신청
- 매장별 방송 현황

**목표 시스템**
```typescript
// 방송 스키마
model Broadcast {
  id          String           @id @default(cuid())
  code        String           @unique // 방송코드
  sellerId    String
  seller      User             @relation(fields: [sellerId], references: [id])
  platform    BroadcastPlatform
  scheduledAt DateTime         // 예정 일시
  startedAt   DateTime?        // 시작 일시
  endedAt     DateTime?        // 종료 일시
  status      BroadcastStatus  @default(SCHEDULED)
  memo        String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

enum BroadcastPlatform {
  GRIP      // 그립
  CLME      // 클메
  YOUTUBE   // 유튜브
  TIKTOK    // 틱톡
  BAND      // 밴드
  OTHER     // 기타
}

enum BroadcastStatus {
  SCHEDULED // 예정
  LIVE      // 방송중
  ENDED     // 종료
  CANCELED  // 취소
}
```

**기능 상세**
- 방송 신청 (달력에서 날짜 선택)
- 방송 시작/종료 버튼
- 방송 현황 조회
  - 셀러: 본인 방송만 조회
  - 관리자: 소속 셀러 방송 조회
  - 마스터: 전체 방송 조회
- 월간 달력 뷰 (매장별 방송 일정)
- 플랫폼별 통계 (방송 건수, 평균 시간)

**API 엔드포인트**
- `POST /api/broadcasts` - 방송 신청
- `PUT /api/broadcasts/:id/start` - 방송 시작
- `PUT /api/broadcasts/:id/end` - 방송 종료
- `GET /api/broadcasts?month=2026-04` - 월간 방송 목록
- `GET /api/broadcasts/stats` - 플랫폼별 통계

**UI 컴포넌트**
- `BroadcastCalendar` - 월간 달력 (react-big-calendar)
- `BroadcastForm` - 방송 신청 폼
- `BroadcastStatusBadge` - 상태 표시

---

#### FR-05: 판매 현황 조회
**우선순위**: P1 (High)

**현재 시스템**
- 기간별 조회: 주간, 월간, 전체
- 판매 통계: 총 매출, 건수, 평균 단가
- 셀러별 성과 비교

**목표 시스템**
```typescript
// 판매 스키마
model Sale {
  id          String   @id @default(cuid())
  saleNo      String   @unique // 판매번호
  sellerId    String
  seller      User     @relation(fields: [sellerId], references: [id])
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  broadcastId String?
  broadcast   Broadcast? @relation(fields: [broadcastId], references: [id])
  quantity    Int
  unitPrice   Int
  totalPrice  Int      // quantity * unitPrice
  saleDate    DateTime @default(now())
  createdAt   DateTime @default(now())
}
```

**기능 상세**
- 기간 필터 (주간, 월간, 사용자 지정)
- 통계 대시보드
  - 총 매출액 (KRW)
  - 판매 건수
  - 평균 단가
  - 전년 대비 증감률
- 셀러별 랭킹 (Top 10)
- 상품별 판매 순위
- 차트 시각화 (Recharts)
  - 일별 매출 추이 (LineChart)
  - 플랫폼별 매출 비중 (PieChart)

**API 엔드포인트**
- `GET /api/sales?from=2026-04-01&to=2026-04-30` - 기간별 판매 내역
- `GET /api/sales/stats?period=month` - 판매 통계
- `GET /api/sales/ranking?type=seller` - 셀러 랭킹

**UI 컴포넌트**
- `SalesDashboard` - 통계 대시보드
- `SalesChart` - 매출 추이 차트
- `SalesRanking` - 랭킹 테이블

---

### 3.2 비기능 요구사항

#### NFR-01: 성능
- 바코드 조회 응답 시간 <100ms
- 페이지 로딩 시간 <1초 (LCP)
- Excel 파일 업로드 처리 <5초 (최대 1000행)
- 동시 사용자 500명 지원

#### NFR-02: 보안
- HTTPS 통신 (Vercel 자동 제공)
- 비밀번호 bcrypt 해싱 (cost factor: 10)
- JWT 토큰 만료 시간 (Access: 1시간, Refresh: 7일)
- SQL Injection 방지 (Prisma ORM)
- XSS 방지 (React 기본 escape)
- CSRF 방지 (NextAuth CSRF 토큰)

#### NFR-03: 확장성
- Serverless 아키텍처 (Vercel Edge Functions)
- 데이터베이스 자동 스케일링 (Neon)
- CDN 캐싱 (정적 리소스)
- API Rate Limiting (IP당 100 req/min)

#### NFR-04: 유지보수성
- TypeScript 100% 적용
- ESLint + Prettier 코드 품질 관리
- Prisma 마이그레이션 버전 관리
- Git 브랜치 전략 (main, develop, feature/*)
- 자동 배포 (Vercel CI/CD)

#### NFR-05: 접근성
- WCAG 2.1 AA 수준 준수
- 키보드 네비게이션 지원
- 스크린 리더 호환 (ARIA labels)
- 모바일 반응형 디자인 (Tailwind CSS)

---

## 4. 기술 스택

### 4.1 프론트엔드
```json
{
  "framework": "Next.js 16 (App Router)",
  "runtime": "React 19",
  "ui": "shadcn/ui (base-nova theme)",
  "styling": "Tailwind CSS 4",
  "charts": "Recharts 2.x",
  "forms": "React Hook Form + Zod",
  "table": "TanStack Table v8",
  "icons": "lucide-react",
  "font": "Pretendard Variable"
}
```

### 4.2 백엔드
```json
{
  "runtime": "Next.js API Routes (Serverless)",
  "database": "Neon PostgreSQL (serverless)",
  "orm": "Prisma 7",
  "authentication": "NextAuth v5",
  "password": "bcrypt",
  "validation": "Zod"
}
```

### 4.3 인프라
```json
{
  "hosting": "Vercel",
  "cdn": "Vercel Edge Network",
  "database": "Neon (Singapore region)",
  "ci/cd": "Vercel Git Integration"
}
```

### 4.4 개발 도구
```json
{
  "language": "TypeScript 5.x",
  "package_manager": "npm",
  "linting": "ESLint",
  "formatting": "Prettier",
  "git": "Git + GitHub",
  "ide": "VSCode"
}
```

---

## 5. 아키텍처 설계

### 5.1 시스템 구조
```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                   │
│                    (CDN + Edge Functions)                │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼──────────┐        ┌────────▼────────┐
│   Next.js App    │        │  API Routes     │
│   (SSR + CSR)    │        │  (Serverless)   │
└───────┬──────────┘        └────────┬────────┘
        │                            │
        │                    ┌───────▼────────┐
        │                    │  Prisma ORM    │
        │                    └───────┬────────┘
        │                            │
        │                    ┌───────▼────────┐
        │                    │ Neon PostgreSQL│
        │                    │  (Serverless)  │
        │                    └────────────────┘
        │
┌───────▼──────────────────────────────────────┐
│          Browser (React 19)                  │
│  - shadcn/ui Components                      │
│  - TanStack Table                            │
│  - Recharts                                  │
└──────────────────────────────────────────────┘
```

### 5.2 디렉토리 구조
```
live-commerce/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 인증 Route Group
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/              # 메인 Route Group (인증 필요)
│   │   ├── layout.tsx       # 공통 레이아웃
│   │   ├── dashboard/       # 대시보드
│   │   ├── barcode/         # 바코드 스캔
│   │   ├── orders/          # 발주 관리
│   │   ├── broadcasts/      # 방송 일정
│   │   ├── sales/           # 판매 현황
│   │   └── users/           # 사용자 관리
│   └── api/                 # API Routes
│       ├── auth/            # NextAuth
│       ├── products/
│       ├── orders/
│       ├── broadcasts/
│       ├── sales/
│       └── users/
├── components/              # React 컴포넌트
│   ├── ui/                  # shadcn/ui
│   ├── barcode/             # 바코드 관련
│   ├── orders/              # 발주 관련
│   ├── broadcasts/          # 방송 관련
│   └── sales/               # 판매 관련
├── lib/                     # 유틸리티
│   ├── api/                 # API 헬퍼
│   │   ├── create-crud-handler-prisma.ts
│   │   ├── middleware.ts
│   │   └── repositories/
│   ├── auth.ts              # NextAuth 설정
│   ├── db/                  # Prisma
│   │   └── prisma.ts
│   ├── utils.ts             # 공통 유틸
│   └── constants/           # 상수
├── prisma/                  # Prisma
│   ├── schema.prisma
│   ├── prisma.config.ts
│   └── seed.ts
├── types/                   # TypeScript 타입
├── public/                  # 정적 파일
├── docs/                    # PDCA 문서
├── .env.local               # 환경 변수
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 5.3 데이터베이스 스키마 (ERD)
```
┌──────────────┐         ┌──────────────┐
│     User     │◄────────│   Broadcast  │
│──────────────│  1   ∞  │──────────────│
│ id           │         │ id           │
│ email        │         │ code         │
│ name         │         │ sellerId     │
│ role         │         │ platform     │
│ adminId      │─┐       │ scheduledAt  │
└──────────────┘ │       │ startedAt    │
       ▲         │       │ endedAt      │
       │1        │       │ status       │
       │         │       └──────────────┘
       │∞        │              │1
┌──────┴───────┐ │              │∞
│    Order     │ │       ┌──────▼───────┐
│──────────────│ │       │     Sale     │
│ id           │ │       │──────────────│
│ orderNo      │ │       │ id           │
│ sellerId     │ │       │ saleNo       │
│ adminId      │─┘       │ sellerId     │
│ status       │         │ productId    │
│ totalAmount  │         │ broadcastId  │
└──────┬───────┘         │ quantity     │
       │1                │ totalPrice   │
       │∞                └──────────────┘
┌──────▼───────┐                │∞
│  OrderItem   │                │
│──────────────│         ┌──────▼───────┐
│ id           │         │   Product    │
│ orderId      │         │──────────────│
│ productId    │─────────┤ id           │
│ quantity     │      ∞1 │ code         │
│ unitPrice    │         │ name         │
│ totalPrice   │         │ barcode      │
└──────────────┘         │ sellPrice    │
                         │ supplyPrice  │
                         │ totalStock   │
                         │ stockMujin   │
                         │ stock1       │
                         │ stock2       │
                         │ stock3       │
                         └──────────────┘
```

---

## 6. 마이그레이션 전략

### 6.1 데이터 마이그레이션

**Phase 1: 데이터 추출 (Google Sheets)**
1. GAS 스크립트로 데이터 CSV 추출
2. 데이터 검증 (null 값, 타입 체크)
3. 데이터 정제 (중복 제거, 형식 통일)

**Phase 2: 스키마 생성 (Neon PostgreSQL)**
1. Prisma 스키마 정의 (`schema.prisma`)
2. 마이그레이션 생성 (`prisma migrate dev`)
3. 데이터베이스 배포 (`prisma migrate deploy`)

**Phase 3: 데이터 임포트**
1. CSV → JSON 변환 스크립트
2. Prisma Seed 스크립트 작성
3. 데이터 임포트 실행 (`prisma db seed`)
4. 데이터 검증 (건수, 무결성)

**Phase 4: 병렬 운영 (2주)**
1. 기존 GAS 시스템 유지
2. 새 시스템 베타 테스트
3. 피드백 수집 및 수정
4. 최종 데이터 동기화

**Phase 5: 완전 전환**
1. GAS 시스템 읽기 전용 전환
2. 새 시스템 프로덕션 배포
3. 사용자 교육 (30분 세션)
4. GAS 시스템 종료 (1개월 후)

### 6.2 코드 재사용 (Hyudo ERP)

**재사용 가능한 컴포넌트**
```typescript
// 1. 인증 시스템
lib/auth.ts                    // NextAuth 설정
app/api/auth/setup-password/   // 비밀번호 설정
app/login/page.tsx             // 로그인 UI

// 2. CRUD API 팩토리
lib/api/create-crud-handler-prisma.ts
lib/api/middleware.ts (withAuth, withRole, withRateLimit)

// 3. DataTable 컴포넌트
components/data-table/
  - data-table.tsx
  - data-table-toolbar.tsx
  - data-table-pagination.tsx
  - data-table-column-header.tsx

// 4. shadcn/ui 설정
components/ui/                 // 40+ 컴포넌트
lib/utils.ts                   // cn 헬퍼
tailwind.config.ts             // base-nova 테마

// 5. Prisma 유틸
lib/db/prisma.ts               // Neon adapter
prisma/prisma.config.ts        // Prisma 7 설정
```

**수정 필요한 부분**
- 도메인 로직 (전자결재 → 라이브커머스)
- Prisma 스키마 (41 tables → 6 tables)
- 네비게이션 메뉴
- 대시보드 KPI

---

## 7. 개발 일정

### 7.1 Timeline (4주)

**Week 1: 프로젝트 설정 + 인증**
- Day 1-2: Next.js 프로젝트 생성, 기본 설정
- Day 3-4: Prisma 스키마 정의, Neon DB 연결
- Day 5-7: NextAuth 인증 구현, 권한 관리

**Week 2: 핵심 기능 (바코드 + 발주)**
- Day 8-10: 바코드 스캔 + 재고 조회
- Day 11-14: 발주 관리 (Excel 업로드, CRUD)

**Week 3: 핵심 기능 (방송 + 판매)**
- Day 15-17: 방송 일정 관리
- Day 18-21: 판매 현황 대시보드

**Week 4: 데이터 마이그레이션 + 배포**
- Day 22-24: 데이터 마이그레이션 (GAS → Neon)
- Day 25-26: Vercel 프로덕션 배포
- Day 27-28: 베타 테스트 + 버그 수정

### 7.2 Milestones

| Milestone | 완료 조건 | 기한 |
|-----------|----------|------|
| M1: 프로젝트 초기화 | Next.js + Prisma + Neon 연결 성공 | Week 1 |
| M2: 인증 완료 | 로그인/회원가입/역할별 접근제어 동작 | Week 1 |
| M3: 바코드 + 발주 완료 | 바코드 조회 + Excel 발주 업로드 동작 | Week 2 |
| M4: 방송 + 판매 완료 | 방송 일정 + 통계 대시보드 동작 | Week 3 |
| M5: 배포 완료 | Vercel 프로덕션 배포 + 데이터 마이그레이션 | Week 4 |

---

## 8. 리스크 관리

### 8.1 기술 리스크

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|-----------|
| Neon DB 성능 이슈 | High | 인덱스 최적화, 쿼리 캐싱, Connection pooling |
| Excel 파일 파싱 실패 | Medium | xlsx 라이브러리 검증, 에러 핸들링 강화 |
| 동시 사용자 부하 | Medium | Vercel Edge Functions, Rate Limiting |
| 데이터 마이그레이션 오류 | High | 백업 스크립트, 롤백 계획, 단계별 검증 |

### 8.2 일정 리스크

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|-----------|
| 요구사항 추가 변경 | High | 스코프 동결, Phase 2로 연기 |
| 예상보다 복잡한 기능 | Medium | 버퍼 시간 확보 (4주 → 5주) |
| 데이터 마이그레이션 지연 | High | GAS 병렬 운영 기간 연장 가능 |

### 8.3 비즈니스 리스크

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|-----------|
| 사용자 적응 실패 | High | UI 유사성 유지, 사용자 교육 세션 |
| 기존 시스템 의존성 | Medium | 병렬 운영 2주, 데이터 동기화 스크립트 |
| 예산 초과 | Low | Vercel Free Tier, Neon Free Tier 활용 |

---

## 9. 성공 기준

### 9.1 기능 성공 기준
- ✅ 4대 핵심 기능 100% 동작
- ✅ 역할별 접근 제어 정상 작동
- ✅ Excel 발주서 업로드 성공률 95% 이상
- ✅ 바코드 조회 응답 시간 <100ms

### 9.2 성능 성공 기준
- ✅ Lighthouse 성능 점수 90점 이상
- ✅ LCP <1초
- ✅ 동시 사용자 500명 처리
- ✅ API 응답 시간 <200ms (p95)

### 9.3 품질 성공 기준
- ✅ TypeScript 에러 0건
- ✅ ESLint 에러 0건
- ✅ Prisma 마이그레이션 성공
- ✅ 프로덕션 빌드 에러 0건

### 9.4 사용자 만족도
- ✅ 베타 테스트 사용자 만족도 80% 이상
- ✅ 기존 시스템 대비 작업 시간 30% 단축
- ✅ UI/UX 개선 만족도 85% 이상

---

## 10. 참고 자료

### 10.1 기술 문서
- [Next.js 16 App Router Docs](https://nextjs.org/docs/app)
- [Prisma 7 Documentation](https://www.prisma.io/docs)
- [NextAuth v5 Documentation](https://next-auth.js.org/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Neon PostgreSQL Docs](https://neon.tech/docs)

### 10.2 내부 참조
- Hyudo ERP 프로젝트 (`/Users/jinwoo/Desktop/Hyudo`)
  - `lib/auth.ts` - NextAuth 설정
  - `lib/api/create-crud-handler-prisma.ts` - CRUD 팩토리
  - `components/data-table/` - DataTable 컴포넌트
  - `prisma/schema.prisma` - Prisma 스키마 예시

### 10.3 원본 시스템
- Google Apps Script 시스템 URL
- Google Sheets 데이터 구조

---

## 11. 승인

**계획 승인**
- [ ] 요구사항 확인 완료
- [ ] 기술 스택 승인
- [ ] 일정 승인
- [ ] 리스크 대응 방안 승인

**다음 단계**
- `/pdca design live-commerce-migration` - Design 문서 작성
- Design 승인 후 개발 시작

---

**작성자**: Claude Code
**최종 수정일**: 2026-04-05
