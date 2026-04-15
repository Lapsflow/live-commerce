# CLAUDE.base.md — 공통 하네스 (Next.js 풀스택)

> ⚠️ 이 파일은 3개 프로젝트 공통 베이스입니다.
> 프로젝트별 설정은 각 레포의 **CLAUDE.md**를 우선합니다.

---

## 📦 공통 스택

```
Frontend  : Next.js 16.2.2 (App Router) + React 19 + TypeScript
Backend   : Next.js API Routes (서버리스)
ORM       : Prisma 7.6 + @prisma/adapter-neon
Auth      : NextAuth 5 beta
Database  : PostgreSQL (Neon 호스팅)
UI        : Tailwind CSS + shadcn/ui
언어      : TypeScript (전체, strict 모드)
```

---

## ⚡ 빠른 명령어 맵

```bash
# 개발 서버
pnpm dev

# 빌드 & 타입 체크
pnpm build

# 타입 체크만
pnpm tsc --noEmit

# 린트
pnpm lint

# Prisma 마이그레이션 생성
pnpm prisma migrate dev --name [설명]

# Prisma 마이그레이션 적용 (프로덕션)
pnpm prisma migrate deploy

# Prisma Studio (DB 브라우저)
pnpm prisma studio

# Prisma 클라이언트 재생성
pnpm prisma generate

# 커밋 전 전체 검증
pnpm tsc --noEmit && pnpm lint && pnpm build
```

---

## 🗺️ 레포지토리 구조 맵

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # 인증 관련 라우트 그룹
│   ├── (dashboard)/            # 로그인 후 라우트 그룹
│   ├── api/                    # API Routes (서버리스)
│   │   ├── auth/[...nextauth]/ # NextAuth 핸들러 (건드리지 말 것)
│   │   └── [domain]/           # 도메인별 API
│   ├── layout.tsx              # 루트 레이아웃
│   └── page.tsx                # 홈
│
├── components/
│   ├── ui/                     # shadcn/ui 원본 (직접 수정 금지)
│   └── [feature]/              # 기능별 커스텀 컴포넌트
│
├── lib/
│   ├── auth.ts                 # NextAuth 설정 (auth() 익스포트)
│   ├── db.ts                   # Prisma 클라이언트 싱글톤
│   └── utils.ts                # 공통 유틸 (cn 함수 등)
│
├── types/                      # 전역 타입 정의
│   └── index.ts
│
└── prisma/
    ├── schema.prisma           # DB 스키마 (단일 진실의 원천)
    └── migrations/             # 마이그레이션 히스토리 (손대지 말 것)
```

---

## 🏛️ 아키텍처 제약

### App Router 규칙
```
Server Component  → 기본값. 데이터 fetching은 여기서.
Client Component  → "use client" 명시 필수. 상태/이벤트 핸들러만.
Server Action     → "use server" 명시. form submit, DB 뮤테이션.

절대 금지:
  ❌ Server Component에서 useState, useEffect 사용
  ❌ Client Component에서 직접 Prisma 호출
  ❌ API Route에서 클라이언트 전용 코드 import
```

### 인증 규칙 (NextAuth 5 beta)
```typescript
// ✅ 올바른 세션 확인 방법
import { auth } from "@/lib/auth"
const session = await auth()
if (!session?.user) redirect("/login")

// ❌ 금지 — 구 버전 방식
import { getServerSession } from "next-auth" // 사용 금지
```

### Prisma 규칙
```typescript
// ✅ db 싱글톤 사용
import { db } from "@/lib/db"

// ❌ 금지 — 매번 new PrismaClient() 생성
const prisma = new PrismaClient()

// ✅ Neon 어댑터 사용 중 — 연결 설정 임의 변경 금지
// lib/db.ts의 neonConfig 설정은 건드리지 말 것
```

### 의존성 방향
```
types → lib → components → app

❌ lib에서 components import 금지
❌ types에서 그 외 import 금지
❌ components/ui/에서 직접 비즈니스 로직 작성 금지
```

---

## 🔒 절대 하지 말아야 할 것들

```
❌ any 타입 사용 — unknown 또는 명시적 타입 사용
❌ prisma/migrations/ 폴더 수동 편집
❌ components/ui/ 파일 직접 수정 (shadcn 원본)
❌ .env 파일 커밋 (.env.local, .env.production)
❌ API Route에서 인증 체크 없이 DB 조회
❌ Client Component에서 서버 전용 환경변수(NEXTAUTH_SECRET 등) 접근
❌ schema.prisma 수정 후 prisma generate 없이 코드 작성
❌ console.log 프로덕션 코드에 남기기
```

---

## 🔄 피드백 루프

### 커밋 전 체크리스트
```
[ ] pnpm tsc --noEmit — 타입 에러 없음
[ ] pnpm lint — ESLint 에러 없음
[ ] pnpm build — 빌드 성공
[ ] Prisma 변경 시 → pnpm prisma generate 완료
[ ] 새 환경변수 추가 시 → .env.example 업데이트
[ ] API Route 추가 시 → 인증 체크 포함됨 확인
```

### 환경변수 관리
```bash
# 필수 환경변수 (없으면 앱 기동 안 됨)
DATABASE_URL=          # Neon PostgreSQL 연결 문자열
NEXTAUTH_SECRET=       # openssl rand -base64 32 로 생성
NEXTAUTH_URL=          # 개발: http://localhost:3000

# 개발 시 .env.local 사용
# 프로덕션 시 호스팅 플랫폼 환경변수 설정
```

---

## 📋 작업 프로토콜

### 새 기능 개발 순서
```
1. schema.prisma 수정 (필요시)
2. pnpm prisma migrate dev --name [기능명]
3. pnpm prisma generate
4. types/ 에 타입 정의
5. lib/ 에 서버 로직 (Server Action 또는 API Route)
6. components/ 에 UI
7. app/ 에 라우트 연결
8. 커밋 전 체크리스트 실행
```

### Prisma 스키마 변경 시 주의
```
schema.prisma 수정
  → prisma migrate dev (개발 DB에 적용 + 마이그레이션 파일 생성)
  → prisma generate (타입 재생성)
  → 관련 코드 업데이트
  → Git 커밋 (schema.prisma + migration 파일 같이)
```

### shadcn/ui 컴포넌트 추가
```bash
# 새 컴포넌트 추가 시
pnpm dlx shadcn@latest add [component-name]

# 절대 components/ui/ 파일 직접 편집 금지
# 커스터마이징 필요 시 → components/[feature]/ 에 래핑 컴포넌트 생성
```

---

## 📚 세부 문서 인덱스

| 문서 | 내용 |
|------|------|
| `.harness/constraints.md` | 아키텍처 제약 상세 |
| `.harness/patterns.md` | Next.js 패턴 예시 모음 |
| `docs/schema.md` | DB 스키마 설계 의도 |
| `docs/plans/` | 진행 중 / 완료 작업 계획 |
