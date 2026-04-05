# Live Commerce Management System

라이브 커머스 관리 시스템 - Google Apps Script에서 Next.js + Neon PostgreSQL로 마이그레이션

## 🚀 프로덕션 배포

**Live URL**: https://live-commerce-opal.vercel.app

## 📋 프로젝트 개요

Google Apps Script 기반 라이브커머스 관리 시스템(v2.5)을 Next.js 16 + React 19 + Neon PostgreSQL로 완전 마이그레이션한 프로젝트입니다.

### 핵심 기능

1. **사용자 인증 및 권한 관리** (P0)
   - NextAuth v5 기반 세션 인증
   - 4단계 역할: MASTER, SUB_MASTER, ADMIN, SELLER

2. **바코드 스캔 및 재고 조회** (P0)
   - 실시간 재고 조회 (응답 시간 <100ms 목표)
   - 바코드/상품코드 검색

3. **발주 관리 시스템** (P0)
   - Excel 파일 업로드
   - 발주 승인/거절 워크플로우

4. **방송 일정 및 판매 현황** (P1)
   - 플랫폼별 방송 관리
   - 통계 대시보드

## 🛠️ 기술 스택

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Runtime**: React 19
- **UI**: shadcn/ui + Tailwind CSS 4
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Table**: TanStack Table v8

### Backend
- **Runtime**: Next.js API Routes (Serverless)
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Prisma 7
- **Authentication**: NextAuth v5
- **Password**: bcrypt

### Infrastructure
- **Hosting**: Vercel
- **CDN**: Vercel Edge Network
- **Database**: Neon (Singapore region)
- **CI/CD**: Vercel Git Integration

## 🚦 Getting Started

### Prerequisites

- Node.js 20+
- npm 또는 pnpm
- Neon PostgreSQL 데이터베이스

### 환경 변수 설정

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```bash
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth v5
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 마이그레이션
npx prisma migrate dev

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📦 프로젝트 구조

```
live-commerce/
├── app/                    # Next.js App Router
│   ├── (main)/            # 메인 Route Group
│   │   ├── barcode/       # 바코드 스캔
│   │   ├── broadcasts/    # 방송 일정
│   │   ├── orders/        # 발주 관리
│   │   └── sales/         # 판매 현황
│   └── api/               # API Routes
├── components/            # React 컴포넌트
│   └── ui/               # shadcn/ui 컴포넌트
├── lib/                  # 유틸리티
│   ├── api/             # API 헬퍼
│   ├── db/              # Prisma 클라이언트
│   └── auth.ts          # NextAuth 설정
├── prisma/              # Prisma
│   ├── schema.prisma    # 데이터베이스 스키마
│   └── migrations/      # 마이그레이션
├── types/               # TypeScript 타입
└── docs/                # PDCA 문서
    └── 01-plan/         # 계획 문서
```

## 🗄️ 데이터베이스 스키마

- **User**: 사용자 및 권한 관리
- **Product**: 상품 및 재고 관리
- **Order**: 발주 관리
- **OrderItem**: 발주 상세
- **Broadcast**: 방송 일정
- **Sale**: 판매 내역
- **RateLimit**: API 속도 제한

## 📚 API 엔드포인트

### Users
- `GET /api/users` - 사용자 목록
- `GET /api/users/:id` - 사용자 상세
- `POST /api/users` - 사용자 생성
- `PUT /api/users/:id` - 사용자 수정
- `DELETE /api/users/:id` - 사용자 삭제

### Products
- `GET /api/products` - 상품 목록
- `GET /api/products/:id` - 상품 상세
- `GET /api/products/search?barcode={barcode}` - 바코드 조회

### Orders
- `GET /api/orders` - 발주 목록
- `POST /api/orders` - 발주 생성
- `PUT /api/orders/:id` - 발주 수정

### Broadcasts
- `GET /api/broadcasts` - 방송 목록
- `POST /api/broadcasts` - 방송 생성

### Sales
- `GET /api/sales` - 판매 내역
- `GET /api/sales/stats` - 판매 통계

## 🚀 Vercel 배포

### 자동 배포 (GitHub 연동)

1. Vercel 대시보드에서 프로젝트 생성
2. GitHub 리포지토리 연결
3. 환경 변수 설정
4. 자동 배포 활성화

### 환경 변수 (Vercel)

Vercel 대시보드 → Settings → Environment Variables에서 설정:

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
AUTH_SECRET=...
AUTH_URL=https://your-domain.vercel.app
```

## 📖 문서

- [Plan 문서](./docs/01-plan/features/live-commerce-migration.plan.md) - 프로젝트 계획서
- [PDCA 프로세스](./docs/) - 개발 프로세스 문서

## 📝 License

Private - All Rights Reserved

## 👥 Team

- **Project Owner**: jinwoo
- **Developer**: Claude Code
- **Users**: 마스터/부마스터/관리자/셀러

---

**Made with ❤️ using Next.js 16 + React 19 + Neon**
