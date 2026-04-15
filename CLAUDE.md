# live-commerce — Multi-Project Harness Integration

> 이 프로젝트는 공통 Next.js 16 + React 19 + Prisma 7.5 하네스를 사용합니다.

---

## 📚 Documentation Structure

```
CLAUDE.md (여기)          → 진입점, 문서 맵
├── @AGENTS.md            → Next.js 16 breaking changes 경고
├── @.harness/base.md     → 공통 스택 규칙 (3개 프로젝트 공유)
├── @.harness/patterns.md → Next.js 패턴 라이브러리
└── @docs/project.md      → live-commerce 전용 설정
```

**메모리**: `~/.claude/projects/.../memory/` (아키텍처, 통합, 주의사항)

---

## ⚡ Quick Start

```bash
# 개발
pnpm dev

# 빌드 + 타입 체크 + 린트 (커밋 전)
pnpm tsc --noEmit && pnpm lint && pnpm build

# Prisma
pnpm prisma migrate dev --name [설명]
pnpm prisma studio
```

---

## 🎯 이 프로젝트는?

Live commerce platform with ONEWMS, multi-marketplace, and AI analysis.

**핵심 기능**:
- Live broadcast management
- Multi-marketplace integration (Coupang, Naver)
- ONEWMS inventory/order sync
- AI-powered sales analysis
- Real-time WebSocket updates

---

## 🔑 프로젝트 특징

### 1. CRUD Factory Pattern (Prisma Variant)
모든 API routes는 `lib/api/create-crud-handler-prisma.ts` 팩토리 사용.

```typescript
export const { list: GET, create: POST } = createCrudHandlerPrisma({
  model: "product",
  createSchema: productCreateSchema,
  updateSchema: productUpdateSchema,
  roles: {
    read: ["MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "ADMIN"]
  }
})
```

### 2. Center-Based Multi-Tenancy
- **MASTER**: 전체 센터 접근
- **SUB_MASTER**: 할당된 센터 관리
- **ADMIN**: 센터 내 전체 관리
- **SELLER**: 센터 내 제한적 접근

User.centerId를 기반으로 자동 필터링.

### 3. Multi-Marketplace Integration
- **Coupang**: 주문 자동 동기화, 재고 업데이트
- **Naver**: 상품 등록, 주문 처리
- **ONEWMS**: 재고/배송 관리 통합

### 4. AI-Powered Analytics
- **Claude API**: 방송 스크립트 분석
- **판매 예측**: 과거 데이터 기반 예측
- **자동 추천**: 상품 조합 최적화

---

## 📋 Core Models

```
Product       → 상품 (단품, 세트)
ProductSet    → 세트 구성
BOM           → 자재 명세서
Order         → 주문 (마켓플레이스별)
OrderProduct  → 주문 상품
Broadcast     → 라이브 방송
Sale          → 판매 실적
Center        → 센터 (지역/운영)
User          → 사용자 (centerId)
Inventory     → 재고
Supplier      → 공급업체
```

상세 스키마: `prisma/schema.prisma`

---

## 🗺️ Route Structure

```
/                           → Redirect to /login
/login                      → NextAuth 로그인

/(main)/                    → 인증 후 메인 레이아웃
├── /products               → 상품 관리
├── /orders                 → 주문 관리
├── /broadcasts             → 방송 관리
├── /sales                  → 판매 실적
├── /inventory              → 재고 관리
└── /suppliers              → 공급업체 관리

/api/                       → API Routes (CRUD factory)
├── /auth/[...nextauth]     → NextAuth (절대 수정 금지)
├── /products               → Product CRUD
├── /orders                 → Order CRUD
├── /onewms                 → ONEWMS 통합
├── /coupang                → Coupang API
└── /naver                  → Naver API
```

---

## ⚠️ 절대 건드리지 말 것

```
app/api/auth/             → NextAuth 핸들러
prisma/migrations/        → 마이그레이션 히스토리
lib/db/prisma.ts          → Neon adapter 설정
lib/services/onewms/      → ONEWMS 통합
node_modules/
.next/
.env (커밋 금지)
```

---

## 🚧 알려진 기술 부채

```
[프로젝트 백로그 참조]
```

---

_최초 작성: 2026-04-15 | 하네스 버전: 1.0_
