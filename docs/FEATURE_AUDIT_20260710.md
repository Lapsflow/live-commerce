# 짜잘한 기능 전수 진단 보고서 (2026-07-10)

> **작성 세션**: cowork
> **범위**: 페이지네이션 배선 / 죽은 링크·버튼 / API 응답 구조 불일치 / 권한·라벨 일관성 — 4개 축 병렬 전수 점검
> **결과**: 확정 버그 15건 수정 완료, 잔여 과제 10건 목록화

---

## 1. 수정 완료 (이번 커밋)

### 1.1 DataTable 페이지네이션 바·툴바 동결 — 사용자 보고 "페이지당 20~50 눌러도 변화 없음"의 원인
- `components/ui/data-table/data-table-pagination.tsx`, `data-table-toolbar.tsx`
- **원인**: 두 컴포넌트가 `memo()`로 감싸져 있는데 TanStack Table 의 `table` 인스턴스는 참조 불변 → props 가 안 바뀌어 **재렌더가 영구 차단**. 페이지당 select 표시값·페이지 번호·이동 버튼 disabled 상태(초기 pageCount=0 기준 → 다음 버튼 영구 비활성)·행 선택 카운트·필터 칩·컬럼 표시 체크박스 전부 초기 렌더에 동결.
- **수정**: memo 제거 (금지 주석 명시). 영향 페이지: /orders, /products, /sales.
- **교훈**: TanStack Table 하위 컴포넌트에 `memo` 금지 — table 인스턴스는 참조가 안 변한다.

### 1.2 상품 "자동 등록" 탭 — 페이지네이션 완전 무효 + 표 데이터 구조 불일치
- `app/api/products/auto-created/route.ts`: `page/limit` 만 읽음 → DataTable 이 보내는 `pageIndex/pageSize` 수용 (구 파라미터 호환 유지). `ok({data,...})` 중첩 응답 → 표준 `paginated()`.
- `app/(main)/products/page.tsx`: `limit=50` 고정 제거, 미검토 카운트 뱃지를 `paginated` 구조(`d.totalCount`)로.

### 1.3 `json.success` 봉투 불일치 클러스터 — 데이터가 있어도 항상 빈 화면 (학습 #9 계열)
`ok()/paginated()` 는 `success` 필드를 만들지 않는데 클라이언트가 `json.success` 로 게이트 → 블록이 절대 실행 안 됨. `/api/uploads` 의 비표준 `{success,data}` 응답을 복붙하며 번진 것으로 추정.
- `app/(main)/admin/audit-log/page.tsx` — **변경 이력 목록·CSV 가 항상 비어 있었음** (MASTER 사이드바 라이브 화면)
- `components/audit/entity-history.tsx` — 상세 페이지 변경 이력 위젯 항상 미표시
- `app/(main)/products/upload-history/page.tsx` — 업로드 이력·센터 필터 항상 비어 있었음 (+ `/api/centers` 응답이 `{centers,count}` 객체인데 배열로 쓰던 이중 결함)
- `app/(main)/admin/center-products/page.tsx` — 요약 카드·상품 목록·CSV 전부 비활성
- `app/(main)/admin/dashboard/components/onewms-status-widget.tsx` — 연결 배지 항상 "연결 안 됨"

### 1.4 죽은 링크
- `app/(main)/inventory/barcode/components/ProductDetailsModal.tsx` — "상세 정보 보기" `/admin/products/[id]`(부재) → `/products/[id]` (학습 #8 유형: 위젯 버튼 → 다음 페이지 동선)
- `app/(main)/admin/dashboard/page.tsx` — `/auth/signin`(부재) → `/login`

### 1.5 권한 격리 (학습 #3)
- `app/(main)/admin/dashboard/page.tsx` — ONEWMS 위젯 페이지가 SUB_MASTER 허용이었음 → MASTER 전용
- `app/api/onewms/stats/route.ts` — SELLER/SUB_MASTER 까지 개방 → MASTER 전용 (UI 호출처는 전부 isMaster 가드라 영향 없음)

### 1.6 기타
- `app/(main)/broadcasts/page.tsx` — `sort=-scheduledAt` 은 CRUD 팩토리가 인식 못 하는 형식(`field:dir`) → 정렬이 조용히 무시되고 createdAt desc 폴백되던 것 수정
- `app/api/products/route.ts` — centerId 없는 셀러 응답 `paginated([],0,0)` → pageCount `NaN` 방지

**검증**: `tsc --noEmit` 통과. ESLint 에러 수 변경 파일 전부 수정 전과 동일(신규 에러 0 — 기존 부채만 잔존).

---

## 2. 잔여 과제 (미수정 — 우선순위순)

### P1 — 정책 결정 필요
1. **SELLER 사이드바 "샘플 요청" → 즉시 튕김**: `sidebar.tsx:42` 가 `/proposals` 로 연결하는데 `proposals/page.tsx:90` 이 SELLER 를 `/dashboard` 로 redirect. 셀러 메뉴가 사실상 死메뉴. → 샘플몰(`/samples`)로 연결할지, redirect 를 풀지 결정 필요.
2. **FailedOrdersList 가 존재하지 않는 API 호출**: `components/onewms/FailedOrdersList.tsx:19,27` 이 `/api/onewms/orders?status=failed`, `/api/onewms/mappings` (GET 라우트 부재) 호출 → `/dashboard/onewms` 의 실패 주문 목록이 항상 비어 보임. GET 라우트 신설 또는 컴포넌트 제거 결정 필요.

### P2 — 데이터 증가 시 터지는 잠복 (학습 #10 계열)
3. **목록 100건 무음 절단**: `/users`(pageSize=100 고정), `/broadcasts`(100 고정), `/samples/manage`(200 요청 → 서버 상한 100으로 절단, 상품 1,729개 중 100개만 로드됨 — **현재도 절단 중일 가능성**). 페이지네이션 UI 도입 필요.
4. **proposals API 무제한 반환**: `app/api/proposals/route.ts:118` take/skip 없음 → 누적 시 OOM 위험.
5. **센터 통계 잠복 crash**: `admin/centers/[id]/stats/page.tsx` 가 API 에 없는 `topProducts/recentOrders` 를 `.map` — 현재는 `success` 게이트가 가려줌. 고아 트리라 미수정. 트리 정리 시 함께 해소.

### P3 — 고아 라우트 정리 (도달 불가, 삭제 또는 redirect)
6. `/admin/centers/*` 트리 전체 (내부 죽은 링크 2개 + 위 5번 crash 포함), `/admin/center-products`, `/orders/by-broadcast`, `/sales`, `/admin/barcode-master`, `/admin/dashboard` — 사이드바 미연결 중복 구현. CLAUDE.md 라우트 맵도 실제와 불일치(문서 갱신 필요).

### P4 — 기술 부채
7. **withRole 내부 `auth()` 재호출 잔존 9개 파일** (문서상 21개에서 감소): users/[id], products/[id], proposals/[id], proposals/samples, stats/admin/[id], stats/seller/[id], broadcasts/month/[ym], broadcasts/[id]/cancel, broadcasts/[id]/confirm — 학습 #4 (role undefined 위험).
8. **onewms/orders/[id]/status API** 가 SELLER 까지 개방 — 주문 상세 ONEWMS 정보의 SUB_MASTER 사용 여부 확인 후 축소.
9. **라벨 하드코딩**: `admin/centers/[id]/stats/page.tsx:138` "관리자"(→ ROLE_LABELS "센터관리자"), `api/users/route.ts:53` "센터 관리자" 띄어쓰기 불일치.
10. **표시 오류**: DataTable server 모드에서 "총 N건" 이 전체가 아닌 현재 페이지 행수 표시 (`getFilteredRowModel` 미주입) — 동작엔 무해.

---

## 3. 배포 체크리스트 (학습 #12)
1. `pnpm tsc --noEmit && pnpm lint && pnpm build` (lint 기존 에러는 별도)
2. `git push origin main` → Vercel 배포 확인
3. 운영 재현: ① /orders 에서 페이지당 20→50 변경·페이지 이동 ② /admin/audit-log 목록 표시 ③ /products 자동등록 탭 ④ 바코드 스캔 → 상세 정보 보기 ⑤ /broadcasts 정렬(방송일시 desc)
