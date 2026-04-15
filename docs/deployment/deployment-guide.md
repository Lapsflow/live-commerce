# 배포 가이드 (Deployment Guide)

> Live Commerce Platform 배포 가이드 - 로컬 개발부터 프로덕션까지

---

## 📋 목차

1. [로컬 개발 환경](#로컬-개발-환경)
2. [환경변수 관리](#환경변수-관리)
3. [Database 설정](#database-설정)
4. [Vercel 배포](#vercel-배포)
5. [CI/CD 파이프라인](#cicd-파이프라인)
6. [배포 체크리스트](#배포-체크리스트)

---

## 🖥️ 로컬 개발 환경

### Prerequisites

**필수 요구사항**:
- **Node.js**: v20 이상
- **npm** 또는 **pnpm**: 최신 버전
- **Git**: 버전 관리
- **PostgreSQL**: 로컬 또는 Neon (권장)

**권장 도구**:
- VS Code + Extensions (Prisma, ESLint, Prettier)
- Postman 또는 Thunder Client (API 테스트)

---

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/live-commerce.git
cd live-commerce
```

---

### 2. 의존성 설치

```bash
# npm 사용 시
npm install

# pnpm 사용 시 (권장)
pnpm install
```

**설치되는 주요 패키지**:
- Next.js 16 (App Router)
- React 19
- Prisma 7
- NextAuth v5
- shadcn/ui + Tailwind CSS 4
- @upstash/redis + @upstash/ratelimit
- @anthropic-ai/sdk (Claude API)

---

### 3. 환경변수 설정

`.env.example`을 복사하여 `.env` 생성:

```bash
cp .env.example .env
```

`.env` 파일 편집:

```bash
# Database (Neon PostgreSQL 권장)
DATABASE_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require&direct=true"

# NextAuth v5
AUTH_SECRET="openssl rand -base64 32 명령어로 생성한 32자 이상 문자열"
AUTH_URL="http://localhost:3000"

# Node Environment
NODE_ENV="development"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_redis_token"

# External APIs (Development용 - 선택사항)
NAVER_CLIENT_ID="your_naver_client_id"
NAVER_CLIENT_SECRET="your_naver_client_secret"
COUPANG_ACCESS_KEY="your_coupang_access_key"
COUPANG_SECRET_KEY="your_coupang_secret_key"
ANTHROPIC_API_KEY="sk-ant-api03-..."

# ONEWMS Integration
ONEWMS_API_URL="https://onewms-api.example.com"
ONEWMS_API_KEY="your_onewms_api_key"

# Google Sheets (Warehouse Sync)
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-sa@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
WAREHOUSE_SHEET_ID="your_google_sheet_id"

# SendGrid (Email Notifications)
SENDGRID_API_KEY="SG.your_sendgrid_api_key"
SENDGRID_FROM_EMAIL="noreply@your-domain.com"

# Cron Secret
CRON_SECRET="openssl rand -base64 32 명령어로 생성한 32자 이상 문자열"

# Development Only (절대 Production에서 사용 금지)
DEV_AUTH_BYPASS="false"
```

---

### 4. Database 설정

#### 4.1. Neon PostgreSQL 생성 (권장)

1. [Neon Console](https://console.neon.tech/) 접속
2. 새 프로젝트 생성
3. Region 선택: **Singapore** (한국과 가까움)
4. Connection String 복사하여 `.env`에 저장

#### 4.2. Prisma 설정

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 마이그레이션
npx prisma migrate dev

# 초기 데이터 시드
npm run prisma:seed
```

**시드 데이터 포함 항목**:
- MASTER 계정 (email: `master@example.com`, password: `master123!`)
- 3개 테스트 센터 (서울, 경기, 인천)
- 샘플 상품 데이터

---

### 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

**기본 로그인 정보**:
- Email: `master@example.com`
- Password: `master123!`

---

## 🔐 환경변수 관리

### 환경변수 검증

배포 전 반드시 환경변수 검증 스크립트 실행:

```bash
npx tsx scripts/security/validate-env.ts
```

**검증 항목**:
- 필수 환경변수 존재 여부
- 환경변수 형식 검증 (URL, API 키 등)
- 클라이언트 노출 위험 확인

---

### 환경별 환경변수

| 환경 | 파일 | 용도 |
|------|------|------|
| **Development** | `.env` | 로컬 개발 |
| **Staging** | Vercel Preview | PR 리뷰 및 테스트 |
| **Production** | Vercel Production | 실제 서비스 |

**⚠️ 중요**:
- `.env` 파일은 `.gitignore`에 포함되어야 함
- `.env.example`만 Git에 커밋
- 실제 값은 절대 커밋하지 말 것

---

## 🗄️ Database 설정

### Neon PostgreSQL 권장 사항

**Plan 선택**:
- **Free Tier**: 개발/테스트 (0.5GB 스토리지, 1 compute)
- **Launch**: Staging (10GB 스토리지, 2 compute)
- **Scale**: Production (50GB+ 스토리지, autoscaling)

**Compute Settings**:
- Min compute: 0.25 CU (Free tier)
- Max compute: 1 CU (Production autoscaling)
- Auto-suspend: 5분 (비활동 시)

**Connection Pooling**:
```bash
# Pooled connection (Next.js API Routes용)
DATABASE_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require&pgbouncer=true"

# Direct connection (Prisma Migrate용)
DIRECT_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require"
```

---

### 마이그레이션 관리

**새 마이그레이션 생성**:
```bash
# 스키마 변경 후 실행
npx prisma migrate dev --name add_new_feature
```

**Production 마이그레이션**:
```bash
# Vercel 배포 시 자동 실행됨 (package.json postinstall)
npx prisma migrate deploy
```

**마이그레이션 롤백** (주의):
```bash
# 마지막 마이그레이션 되돌리기
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## 🚀 Vercel 배포

### 1. Vercel 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. **New Project** 클릭
3. GitHub 저장소 연결
4. Framework Preset: **Next.js** 자동 선택
5. Root Directory: 기본값 (`.`)
6. **Deploy** 클릭

---

### 2. 환경변수 설정

Vercel Dashboard → **Settings** → **Environment Variables**

**Production 환경변수 추가**:

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
AUTH_SECRET=<32자 이상>
AUTH_URL=https://your-domain.vercel.app
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
COUPANG_ACCESS_KEY=...
COUPANG_SECRET_KEY=...
ANTHROPIC_API_KEY=sk-ant-api03-...
ONEWMS_API_URL=https://...
ONEWMS_API_KEY=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
WAREHOUSE_SHEET_ID=...
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@your-domain.com
CRON_SECRET=<32자 이상>
```

**⚠️ 주의사항**:
- `AUTH_URL`은 Vercel 도메인으로 변경
- `GOOGLE_PRIVATE_KEY`는 전체 키 복사 (줄바꿈 포함)
- `DEV_AUTH_BYPASS`는 Production에 추가하지 말 것

---

### 3. Domain 연결

Vercel Dashboard → **Settings** → **Domains**

1. Custom Domain 추가
2. DNS 레코드 설정:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   ```
3. SSL 인증서 자동 발급 (Let's Encrypt)

---

### 4. Cron Jobs 설정

Vercel Dashboard → **Settings** → **Cron Jobs**

**자동 설정됨** (`vercel.json`):
- Stock Sync: 6시간마다
- Delivery Sync: 10분마다
- Warehouse Sync: 매일 자정

**Cron 인증**:
- `Authorization: Bearer <CRON_SECRET>` 헤더 필수
- `CRON_SECRET` 환경변수 설정 필수

---

### 5. 배포 트리거

**자동 배포**:
- `main` 브랜치에 push → Production 배포
- Feature 브랜치에 PR 생성 → Preview 배포

**수동 배포**:
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

---

## 🔄 CI/CD 파이프라인

### GitHub Actions (선택사항)

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run format
      - run: npx prisma generate
      - run: npm run test:e2e
```

---

### Vercel Build 설정

**package.json scripts**:
```json
{
  "scripts": {
    "build": "next build",
    "postinstall": "prisma generate"
  }
}
```

**Build 프로세스**:
1. `npm install` - 의존성 설치
2. `prisma generate` - Prisma 클라이언트 생성
3. `next build` - Next.js 빌드

---

## ✅ 배포 체크리스트

### Pre-Deployment (배포 전)

#### 환경 확인
- [ ] Node.js 버전: v20 이상
- [ ] 환경변수 검증: `npx tsx scripts/security/validate-env.ts`
- [ ] `.env` 파일이 `.gitignore`에 포함됨

#### 코드 품질
- [ ] ESLint 통과: `npm run lint`
- [ ] Prettier 통과: `npm run format`
- [ ] TypeScript 컴파일 성공: `npx tsc --noEmit`
- [ ] Build 성공: `npm run build`

#### 데이터베이스
- [ ] Prisma migrate 성공: `npx prisma migrate dev`
- [ ] 시드 데이터 확인: `npm run prisma:seed`
- [ ] Database 백업 완료 (Production)

#### 보안
- [ ] `AUTH_SECRET` 32자 이상 랜덤 문자열
- [ ] `CRON_SECRET` 32자 이상 랜덤 문자열
- [ ] npm audit 통과 (High/Critical 없음)
- [ ] Security headers 설정 확인 (`next.config.ts`)
- [ ] Rate limiting 구현 확인

#### 테스트
- [ ] E2E 테스트 통과: `npm run test:e2e`
- [ ] API 벤치마크 실행: `npx tsx scripts/performance/api-benchmark.ts`
- [ ] Manual QA 완료

---

### Deployment (배포)

#### Vercel 설정
- [ ] Vercel 프로젝트 생성
- [ ] GitHub 저장소 연결
- [ ] Production 환경변수 모두 설정
- [ ] Domain 연결 (선택사항)
- [ ] SSL 인증서 발급 확인

#### 첫 배포
- [ ] `main` 브랜치에 push
- [ ] Vercel 빌드 성공 확인
- [ ] Deployment URL 접속 테스트
- [ ] Database 연결 확인 (Logs 확인)

---

### Post-Deployment (배포 후)

#### 기능 검증
- [ ] 로그인 테스트 (MASTER 계정)
- [ ] 바코드 검색 테스트
- [ ] 발주 생성 테스트
- [ ] ONEWMS 동기화 테스트
- [ ] Cron jobs 실행 확인 (Vercel Logs)

#### 모니터링
- [ ] Vercel Analytics 활성화
- [ ] Error tracking 설정 (Sentry 권장)
- [ ] Uptime monitoring 설정 (UptimeRobot 등)
- [ ] Database 모니터링 (Neon Console)

#### 문서화
- [ ] 배포 일시 및 버전 기록
- [ ] 변경사항 문서화 (CHANGELOG.md)
- [ ] 팀원에게 배포 공지

---

## 🔧 트러블슈팅

### Build 실패

**문제**: `Prisma Client not found`
```bash
# 해결: Prisma 클라이언트 재생성
npx prisma generate
```

**문제**: `Environment variable not found`
```bash
# 해결: Vercel 환경변수 확인
vercel env pull .env.local
```

---

### Database 연결 실패

**문제**: `Connection timeout`
```bash
# 해결: Neon compute가 suspend 상태
# Neon Console에서 compute 재시작 또는
# DATABASE_URL에 pgbouncer=true 추가
```

**문제**: `SSL required`
```bash
# 해결: CONNECTION_URL에 sslmode 추가
DATABASE_URL="postgresql://...?sslmode=require"
```

---

### Cron Jobs 실행 안 됨

**문제**: Cron이 실행되지 않음
```bash
# 해결: CRON_SECRET 환경변수 확인
# Vercel Dashboard → Settings → Environment Variables
# CRON_SECRET 추가

# Cron 로그 확인
vercel logs --follow
```

---

## 📚 참고 자료

- [Next.js 배포 문서](https://nextjs.org/docs/deployment)
- [Vercel 배포 가이드](https://vercel.com/docs/deployments/overview)
- [Neon PostgreSQL 문서](https://neon.tech/docs)
- [Prisma 마이그레이션 가이드](https://www.prisma.io/docs/orm/prisma-migrate)

---

**Last Updated**: 2026-04-14
**Maintained By**: DevOps Team
