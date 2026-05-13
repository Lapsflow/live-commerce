# live-commerce — Live Commerce Platform

> Next.js 16 + React 19 + Prisma 7.5
> Live broadcast management, multi-marketplace integration, ONEWMS inventory sync, AI-powered analytics

---

## ⚡ Quick Start

```bash
# 개발
pnpm dev

# 빌드 + 타입 체크 + 린트 (커밋 전 필수)
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

## 🧭 Boris's Principles (Original)

> Source: Boris Cherny (creator of Claude Code, Anthropic).
> Applied verbatim. Do not paraphrase or translate when invoking these as guidance.

### Team operating principles (3)

1. **"What's better than doing something? Having Claude do it."**
   "If you have Claude, you can really automate a lot of work, and that's kind of what we see over and over."

2. **"Underfund things a little bit."**
   "There's this interesting thing when you underfund everything a little bit, because then people are kind of forced to Claude-ify."

3. **"Encouraging people to go faster."**
   "Early on, it was really important because it was just me, and so our only advantage was speed. That's the only way that we could ship a product that would compete in this very crowded coding market."

### Engineering / coding principles

4. **Plan first, code second.**
   "Never let Claude write code until you've reviewed and approved a written plan. This separation of planning and execution is the single most important thing — it prevents wasted effort, keeps the developer in control of architecture decisions, and produces significantly better results with minimal token usage."

5. **CLAUDE.md is a log of mistakes.**
   "Anytime we see Claude do something incorrectly we add it to the CLAUDE.md, so Claude knows not to do it next time." (Anthropic's internal CLAUDE.md is ~2.5k tokens.)

6. **Slash commands for every inner loop.**
   "Using slash commands for every inner loop workflow done many times a day saves from repeated prompting and allows Claude to use these workflows too." Commands live in `.claude/commands/` and are checked into git.

7. **The engineer's contribution is judgment, not code.**
   "Judgment about what to build, how to verify it, when to trust the output, and when to push back."

8. **Conductor model.**
   "Stop being a typist and become an orchestrator — run multiple AI agents in parallel, each working on a separate branch."

9. **Latent demand — meet users where they already work.**
   "Bring the tool to wherever people already work, rather than requiring people to adapt to a new environment."

**Sources**:
- [Head of Claude Code: What happens after coding is solved — Lenny's Newsletter](https://www.lennysnewsletter.com/p/head-of-claude-code-what-happens)
- [Claude Code creator says these are the 3 principles he shares with every member of his team — AOL](https://www.aol.com/articles/claude-code-creator-says-3-100502587.html)
- [Building Claude Code with Boris Cherny — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny)
- [How Boris Uses Claude Code](https://howborisusesclaudecode.com/)
- [Inside the Development Workflow of Claude Code's Creator — InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)

---

## 📝 Log of mistakes (Principle #5 — this CLAUDE.md as a learning record)

> 같은 실수를 두 번 하지 않기 위해 작업 중 발견된 교훈을 여기에 누적합니다.

1. **사이드바 라우팅을 항상 먼저 확인할 것.**
   - 2026-05-10: `/admin/centers/new` 페이지를 수정했지만 운영 사이드바는 `/centers` 로 연결. 결과적으로 운영 화면에 반영되지 않았음. 이후 일관성 차원에서 `/admin/...` 사용 안 함.
   - 다음에 페이지를 수정하기 전엔 반드시 `components/layout/sidebar.tsx` 의 `menuByRole` 매핑부터 grep으로 확인.

2. **운영 도메인은 `www.supermujin.ai`.**
   - `live-commerce-opal.vercel.app` 은 Vercel 자동 생성 URL — Playwright/CI 전용. 사용자 안내 메시지·문서·테스트 BASE_URL에는 절대 사용 금지.

3. **권한 격리는 기본값 `isMaster` 로 시작.**
   - "관리자라면 모두 보임" (`!isSeller`, `isMasterOrSub`) 패턴은 SUB_MASTER 에게 본사 정보 노출 위험. 본사 전용 정보는 명시적으로 `isMaster` 로만 표출.

4. **`withRole` 의 `user` 파라미터를 그대로 쓸 것.**
   - 핸들러 안에서 `auth()` 를 다시 호출하면 API request 컨텍스트에서 세션이 잡히지 않아 role 이 undefined 가 됨. `withRole(["MASTER"], async (req, user) => { ... })` 의 `user` 사용.

5. **FormData 는 한 번만 읽을 수 있다.**
   - `await req.formData()` 를 try 블록 안에서 호출한 뒤 catch fallback 에서 또 호출하면 소진된 상태. 한 번만 읽어서 변수에 저장 후 재사용.

6. **신규 페이지를 만들기 전, 사이드바·기존 페이지 라벨 패턴부터 확인.**
   - 기존 코드는 `ROLE_LABELS` 매핑이 이미 있었는데 한 곳에 `"센터 관리자"` 가 하드코딩되어 있었음. 일관성 검색을 먼저 한 뒤 매핑 활용.

7. **Prisma generate 는 sandbox 에서 안 됨.**
   - 스키마/마이그레이션 수정 후 `prisma generate` 는 사용자의 로컬 머신에서 실행. 샌드박스는 binaries.prisma.sh 차단됨.

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
    read: ["MASTER", "SUB_MASTER", "SELLER"],
    write: ["MASTER", "SUB_MASTER"]
  }
})
```

### 2. Center-Based Multi-Tenancy
- **MASTER** (UI 라벨: "마스터(본사)"): 전체 센터 접근
- **SUB_MASTER** (UI 라벨: "센터관리자"): 할당된 센터 관리
- **SELLER** (UI 라벨: "셀러"): 자기 방송·발주·정산만

UI 라벨 매핑: `lib/constants/role-labels.ts` 의 `ROLE_LABELS` 사용. 하드코딩 금지.

User.centerId 기반 자동 필터링.

### 3. Multi-Marketplace Integration
- **Coupang**: 주문 자동 동기화, 재고 업데이트
- **Naver**: 상품 등록, 주문 처리
- **ONEWMS**: 재고/배송 관리 통합 (MASTER 전용 화면)

### 4. AI-Powered Analytics
- **Claude API**: 방송 스크립트 분석
- **판매 예측**: 과거 데이터 기반 예측
- **자동 추천**: 상품 조합 최적화

---

## 📋 Core Models

```
Product       → 상품 (productType: HEADQUARTERS | CENTER)
ProductSet    → 세트 구성
BOM           → 자재 명세서
ProductCenterStock → 센터별 재고
Order         → 발주 (productType, broadcastId, processingCenterId)
OrderItem     → 발주 상품
Broadcast     → 라이브 방송
Sale          → 판매 실적
Center        → 센터 (지역/운영)
User          → 사용자 (centerId)
Proposal      → 상품 제안 (쇼핑몰형)
Supplier      → 공급업체
OnewmsOrderMapping / OnewmsStockSync → ONEWMS 통합 매핑
```

상세 스키마: `prisma/schema.prisma`

---

## 🗺️ Route Structure (운영 사이드바 기준)

### MASTER 사이드바
```
/dashboard                  → 전체 통계
/users                      → 사용자 관리
/centers                    → 센터 관리 (실제 운영 경로!)
/admin/contracts            → 계약 승인
/orders                     → 발주 관리
/orders/by-broadcast        → 방송별 통합 발주서 (기획서 v2)
/broadcasts                 → 방송 관리
/broadcasts/calendar        → 방송 캘린더
/products                   → 상품 관리
/products/upload            → 엑셀 업로드
/admin/center-products      → 센터 상품 현황
/proposals                  → 상품 제안 (쇼핑몰형)
/samples/requests           → 샘플 요청
/barcode                    → 바코드
/admin/audit-log            → 변경 이력
/admin/sync-monitor         → 동기화 모니터
```

### SUB_MASTER (센터관리자) 사이드바
```
/dashboard                  → 센터 대시보드 (ONEWMS 위젯 미노출)
/users                      → 셀러 관리
/orders                     → 발주 컨펌
/payments                   → 입금 관리
/broadcasts                 → 방송 관리
...
/products                   → 상품 관리 (기본 탭: 우리 센터 제품)
```

### SELLER 사이드바
```
/dashboard                  → 내 통계
/broadcasts                 → 방송 신청
/broadcasts/calendar        → 방송 캘린더
/orders                     → 내 발주
/products                   → 상품 제안
/proposals                  → 샘플 요청
/barcode                    → 바코드
```

### API
```
/api/auth/[...nextauth]     → NextAuth (절대 수정 금지)
/api/centers                → Center CRUD + admin 계정 동시 생성
/api/users/[id]             → 사용자 PUT/DELETE (Soft Delete)
/api/products               → Product CRUD
/api/orders                 → Order CRUD (auto-split by productType)
/api/orders/by-broadcast    → 방송별 통합 발주서
/api/orders/bulk            → 엑셀 업로드 (컨펌 시 WMS 동기화)
/api/proposals              → 제안 CRUD (MASTER 등록은 즉시 APPROVED)
/api/uploads                → 이미지 업로드 (Vercel Blob + base64 fallback)
/api/onewms/*               → ONEWMS 통합 (MASTER 전용)
/api/coupang                → Coupang API
/api/naver                  → Naver API
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

- `withRole` + `auth()` 중복 호출 패턴 21개 파일 일괄 정리 필요 (proposals 2개는 hotfix 적용 완료)
- `/admin/centers/...` 경로 정리 (사용 안 됨, redirect 또는 삭제)
- 시드 데이터 의존 SKIP 16건 (Playwright)
- 자금 정산 자동화 (PDF v2 안정화 후 단계)
- 락(Lock) · 자체 라이브 등록 등 고도화 (PDF v2 운영 데이터 누적 후)

---

_최초 작성: 2026-04-15 · 보리스 원칙 적용: 2026-05-12_
