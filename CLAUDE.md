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

8. **Playwright "100% PASS" 는 시나리오 범위 내에서만 의미가 있다.**
   - 2026-05-12: 보고 메시지 검증 81개 시나리오 PASS 보고 후, 운영에서 마스터 → ONEWMS "전체 보기" 클릭 시 페이지 crash 발견.
   - 갭 원인: 시나리오를 "메시지 항목별"로만 짰고, **위젯 안의 액션 버튼 클릭 → 다음 페이지 동선** 은 검증하지 않았음. "위젯이 렌더되면 OK"라는 안일한 기준.
   - 또 다른 갭: **시드 데이터 1-2건으로는 페이지네이션 부재 같은 데이터 의존 버그가 안 잡힘.** 실제 운영 규모(13,000+) 데이터에서만 드러남.
   - 다음부터: 모든 위젯/카드의 **"링크 클릭 → 진입 → 정상 로드"** 까지 검증 시나리오에 포함. 운영 환경 변수 (Vercel 프로덕션 DB)에서 직접 진입 검증을 최소 1회 추가.
   - "PASS"를 그대로 전달하지 말고, 시나리오에 빠진 동선이 있는지 먼저 의심.

9. **API 응답 구조와 클라이언트 fetch 처리는 항상 함께 확인.**
   - 2026-05-12: `/api/onewms/stock/conflicts` API는 `ok({ conflicts, count })` 로 응답 → 응답 구조는 `{ data: { conflicts: [...], count } }`.
   - 클라이언트는 `json.data` 를 직접 배열로 사용 → `data.map is not a function` TypeError.
   - 데이터 0건일 때는 빈 화면으로 보여 발견되지 않음. 데이터가 있는 운영 환경에서만 crash.
   - `ok<T>(data: T)` 헬퍼는 항상 `{ data: T }` 로 감싼다. 클라이언트는 `json.data.{필드}` 또는 `json.data` 가 어떤 타입인지 한 번 더 확인.

10. **목록 API 와 목록 컴포넌트에는 반드시 페이지네이션부터.**
    - 2026-05-12: `/api/onewms/stock/conflicts` 는 전체 충돌 13,104건을 한 번에 반환. 클라이언트는 13,104개 `<tr>` 렌더 시도 → 브라우저 OOM crash.
    - 신규 목록 만들 때 기본 `limit=50` + `offset` 페이지네이션을 처음부터 도입.
    - "운영 데이터가 적을 때는 괜찮겠지" 가정 금지.

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
/samples/manage             → 샘플 관리 (한국무진 직접 등록, 상태 진행중/품절 — 2026-07-03 확정)
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

11. **외부 API 문서를 먼저 확인하지 않으면 Agent도 추측에 의존한다.**
    - 2026-05-15: P1 API 정리 과정에서 5명 Agent 병렬 실행. Agent 4가 ONEWMS 공식 문서(16-onedas_packing.md, 15-sheet_management.md)를 읽지 않고 "합리적으로 보이는" 필드명 추론.
    - **문제**:
      - OnedasPackingInfo: picking_order_no 포함 → 공식문서에 없음. 실제는 work_date, no, crdate, no_sub, cnt, picking_unit, status
      - OnedasPackingDetailInfo: picking_orders wrapper → 공식문서는 data wrapper
      - AddSheetItemsRequest: supply_code, quantity, unit_price → 공식문서는 product_id|link_id, qty, memo, expire_date, lot_no, location
    - **교훈**:
      1. 외부 서드파티 API는 "공식 문서 테이블" > 추론. 테이블에 없는 필드는 존재하지 않는다고 가정.
      2. Agents가 "그럴듯한 필드명" 패턴을 보면, 원본 문서에서 차용한 게 아닐 수도 있음. 특히 add/get/set 명사 필드 추론 위험.
      3. 복잡한 P1/P2 타입은 마지막에 한 번씩 공식문서 크로스체크. git diff로 추가/제거된 필드 전수 검토.
    - **적용**: 외부 API 타입 정의할 때 항상 공식 .md 테이블 스샷을 주석으로 명시. Agent도 테이블을 읽게 강제.

12. **커밋 ≠ 배포. "배포 완료" 보고 전 push + 운영 검증까지.**
    - 2026-06-08: "비고 (선택)" placeholder 수정 커밋(8e19c59, 6/5 작성)을 로컬 main 에만 두고 push 하지 않은 채 한국무진에 "오늘 배포 완료" 보고. 운영(www.supermujin.ai)은 수정 전 코드 그대로 → 셀러 재현으로 들통, 신뢰 타격.
    - **2026-06-10 재발**: ONEWMS 자동 매칭 형식 커밋(b6d26a0, 6/9 작성)도 똑같이 push 누락 상태에서 "배포 완료" 보고 작성. 보고 직전 점검으로 발견하여 push. → 외부 보고 문구를 쓰기 전에 반드시 ① 체크리스트부터. "커밋 직후 보고 초안 작성" 습관 자체가 위험 신호.
    - 배포 보고 체크리스트: ① `git log origin/main..HEAD` 가 비어있는지 확인 ② `git push origin main` ③ Vercel 배포 성공 확인 ④ **운영 도메인에서 실제 재현** (이 건이면: 운영에서 템플릿 다운로드 → 메모 셀 확인, placeholder 업로드 → 발주 상세 확인) ⑤ 그 다음에야 외부 보고.

13. **데이터 정화 필터는 "저장 시점"과 "외부 전송 시점" 양쪽에 둘 것.**
    - 2026-06-10: memo placeholder 필터를 bulk 업로드 파싱에만 적용 → 필터 배포 이전에 업로드되어 DB 에 placeholder 가 저장된 발주가 컨펌 → ONEWMS 동기화될 때 여전히 placeholder 전송. "새 데이터는 깨끗하다" ≠ "기존 데이터도 깨끗하다".
    - 해결: `lib/utils/memo.ts` 로 필터 공용화, bulk 파싱 + orderSync 양쪽 적용.
    - 일반화: 입력 검증을 추가할 때 이미 DB 에 들어간 오염 데이터의 출구(외부 API 전송, 화면 표시)도 함께 막았는지 확인.

14. **Prisma CLI 는 인라인 `DATABASE_URL` 보다 `.env` 의 `DIRECT_URL` 을 우선한다 — 테스트 실행 전 env 격리 필수.**
    - 2026-07-06: 샌드박스에서 로컬 PG 로 테스트하려고 `DATABASE_URL=로컬주소 prisma migrate deploy` 실행 → `prisma.config.ts` 가 `dotenv/config` 로 `.env` 를 로드하고 `DIRECT_URL ?? DATABASE_URL` 순으로 사용 → `.env` 의 DIRECT_URL(운영 Neon)이 이겨서 **마이그레이션이 운영 DB 에 조기 적용됨**. 해당 건은 additive(enum 추가 + 데이터 이관)라 무해했지만 파괴적 마이그레이션이었다면 사고.
    - 예방: 저장소 사본에서 `.env`/`.env.local` 을 로컬 값으로 통째로 교체 후 실행. `DIRECT_URL` 까지 반드시 덮을 것. 실행 전 `prisma migrate status` 로 대상 DB 를 눈으로 확인.
    - 부수 발견: 샘플몰 스키마(isSample, SampleStatus 등)는 마이그레이션 파일 없이 `db push` 로 운영 반영되어 있음 → 마이그레이션 히스토리만으로 신규 DB 재현 불가 (기술 부채). 신규 로컬 DB 는 `prisma db push` 로 생성할 것.

15. **텍스트 필터는 보이지 않는 문자에 뚫리고, 입구는 하나가 아니다.**
    - 2026-06-10 (2차 재발): 필터 배포 후에도 "비고(선택)" 이 메모로 저장. 재현 결과 zero-width space 등 보이지 않는 문자가 섞이면 화면상 동일해 보여도 정규식 통과 확인. 또한 `/api/orders` POST 가 `data.memo` 를 무필터 저장하는 별도 입구였음.
    - 보강: ① sanitizeMemo 가 invisible chars 제거 후 검사 ② 장식문자·"입력하세요" 접미 허용 ③ 의심 문자열 통과 시 `[MEMO_SUSPECT]` codepoint 로그 → 재발 시 Vercel 로그로 즉시 원인 식별 ④ 발주 생성 모든 입구(bulk + /api/orders POST)에 필터.
    - 일반화: 사용자 입력 텍스트 비교·필터는 NFC/invisible 정규화 먼저. 같은 필드를 쓰는 API 입구를 전수 grep 해서 필터 누락 입구가 없는지 확인. "재현 안 되는 통과 사례"는 codepoint 진단 로그부터 심을 것.

---

_최초 작성: 2026-04-15 · 보리스 원칙 적용: 2026-05-12 · 학습 #11 추가: 2026-05-15 · 학습 #12 추가: 2026-06-08_
