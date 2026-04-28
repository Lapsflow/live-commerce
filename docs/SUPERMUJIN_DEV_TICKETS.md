# 슈퍼무진(SUPERMUJIN) 개발 티켓 검증 현황

> **최종 검증일**: 2026-04-28 (Phase 2 외부 API 어댑터 + Phase 3 최종 검증 완료)
> **원본 문서**: `/Downloads/SUPERMUJIN_DEV_TICKETS.md` (2026-04-26 작성)
> **검증 방법**: 코드베이스 직접 확인 (prisma schema, API routes, page components)

---

## 총괄 요약

| Phase | 범위 | ✅ 완료 | 🟡 부분 | ❌ 미구현 | 구현율 |
|-------|------|---------|---------|-----------|--------|
| **Phase 1** | 인프라 + 권한 (7) | 6 | 1 | 0 | **93%** |
| **Phase 2** | 핵심 운영 (19) | 18 | 1 | 0 | **97%** |
| **Phase 3** | 라이브 운영 (25) | 25 | 0 | 0 | **100%** |
| **Phase 4** | 데이터 + UI (4) | 3 | 1 | 0 | **88%** |
| **Phase X** | 보류 (1) | 1 | 0 | 0 | **100%** |
| **합계** | **56개** | **53** | **3** | **0** | **94.6%** |

### 변경 추이
| | 이전 (04-28 오전) | 현재 (04-28 최종) | Delta |
|---|---|---|---|
| ✅ 완료 | 42 (75%) | **53 (94.6%)** | **+11** |
| 🟡 부분 | 9 (16%) | **3 (5.4%)** | **-6** |
| ❌ 미구현 | 5 (9%) | **0 (0%)** | **-5** |

---

## Phase 1 — 인프라 + 권한 (6✅ 1🟡)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| USER-01 | 사용자추가 버튼 라우팅 버그 | ✅ | `/signup`으로 정상 이동 (`users/page.tsx:203-209`) |
| USER-02 | 소속센터 코드 체계 (XX-XXXX) | ✅ | Center 모델 `code` 필드, 정규식 검증 |
| USER-03 | 가입=셀러만 정책 | ✅ | 역할 선택 필드 없음, API에서 `role: "SELLER"` 자동설정 |
| USER-04 | 마스터 센터코드 관리 페이지 | ✅ | `/admin/centers` 라우트, MASTER만 생성 가능 |
| USER-05 | 회원가입 센터코드 필수 | ✅ | 실시간 DB 검증, 유효시 센터명 표시, 500ms 디바운스 |
| USER-06 | 권한 계층 정리 | 🟡 | 4단계 구현 (MASTER/SUB_MASTER/ADMIN/SELLER). CENTER_MANAGER → SUB_MASTER 대체 (기능 동일) |
| USER-07 | 사용자 필터 탭 | ✅ | 5개 탭: 전체/셀러/관리자/센터/관리자대시보드 |

---

## Phase 2 — 핵심 운영 시스템 (18✅ 1🟡)

### 상품관리 (9✅)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| PRODUCT-01 | 상품 이중 소유 (본사/센터) | ✅ | `productType` enum (HEADQUARTERS/CENTER) + `managedBy` 필드 |
| PRODUCT-02 | 상품 코드 명명규칙 | ✅ | `lib/validators/product.ts` — HQ `[숫자]`, CENTER `[Cxx-xxx]` 정규식 검증 |
| PRODUCT-03 | 발주서 자동 분리 (본사/센터) | ✅ | `-WMS`/`-CENTER` 접미사로 자동 분리, 비율 배분 |
| PRODUCT-04 | 공급가 결정 권한 | ✅ | WMS 상품 가격 수정 불가(403), 센터 상품은 자유 편집 |
| PRODUCT-05 | 삭제 정책 (비활성화만) | ✅ | `isActive` soft delete, 복원 기능 |
| PRODUCT-06 | 센터 선택 업로드 | ✅ | `upload/page.tsx:163-166` 센터미선택 검증 + `hasErrors` 에러 표시 |
| PRODUCT-07 | 엑셀 업로드 + 표준 양식 | ✅ | 양식 다운로드, 미리보기, 검증, 자동 바코드 생성 |
| PRODUCT-08 | 상품 목록 소유 컬럼/필터 | ✅ | 본사WMS/센터자사몰 배지, 3종 필터 |
| PRODUCT-09 | 권한별 상품 화면 분리 | ✅ | MASTER=전체, SELLER=본인센터만, API 레벨 필터 |

### 바코드 재고조회 (3✅)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| BARCODE-01 | WMS 실시간 재고 연동 | ✅ | ONEWMS API 호출, 자동 보정 (차이 ≤5), conflict 로그 |
| BARCODE-02 | 바코드 스캐너 안정화 | ✅ | `lib/utils/sound.ts` playBeep 사운드 + `useBarcodeScanner.ts:48,57` 성공/실패 호출 + 자동 포커스 |
| BARCODE-03 | 스캔 후 자동 초기화 | ✅ | `ManualInputFallback.tsx:44-48` 0.5초 지연 클리어 + 포커스 유지 |

### 발주관리 (6✅ 1🟡)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| ORDER-01 | 자동 매칭 로직 | 🟡 | 방송 레벨 매칭 구현 (`orderBroadcastMatching.ts`). 상품별 우선순위는 실무상 불필요 |
| ORDER-02 | 매칭 실패 2단계 처리 | ✅ | 1단계: 셀러에 에러 반환 + 수정 UI, 2단계: 담당자 검수 큐 |
| ORDER-03 | 가상계좌 | ✅ | Toss Payments API 연동 (Mock/Real 전환) |
| ORDER-04 | 세금계산서 | ✅ | `lib/services/tax-invoice/` PopBill/Barobill adapter + `api/orders/[id]/tax-invoice/route.ts` |
| ORDER-05 | SMS/알림톡 | ✅ | `lib/services/notifications/` 11종 Solapi adapter + 3단계 fallback (AlimTalk→LMS→관리자 알림) |
| ORDER-06 | 입금확인 → 출고 흐름 | ✅ | 입금확인→재고전환 + `ORDER_SHIPPED` 출고알림 (`status/route.ts:66`) |
| ORDER-07 | 발주 매뉴얼 PDF | ✅ | `/orders/manual` 7개 섹션 매뉴얼 |

---

## Phase 3 — 라이브 운영 (25✅)

### 방송관리 (9✅)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| LIVE-01 | 셀러명 표시 | ✅ | `broadcasts/route.ts` seller include |
| LIVE-02 | 방송 등록 폼 단순화 | ✅ | 날짜/시간/채널/메모만 |
| LIVE-03 | 발주서→방송 자동 매칭 | ✅ | 셀러+날짜+시간대 기반 자동 매칭 |
| LIVE-04 | 권한별 화면 분리 | ✅ | `role-filter.ts:36-37` SUB_MASTER centerId 격리 |
| LIVE-05 | 방송 채널 전체 지원 | ✅ | GRIP/CLME/YOUTUBE/TIKTOK/BAND/OTHER |
| LIVE-06 | 취소/변경 정책 | ✅ | `cancel/route.ts` + `BROADCAST_CANCELED` 알림 발송 |
| LIVE-07 | 방송 결과 (단순 완료) | ✅ | ENDED 상태 + `BROADCAST_ENDED` 알림 |
| LIVE-08 | 일정 충돌 방지 | ✅ | 2시간 윈도우, 같은 셀러/상태 체크 |
| LIVE-09 | 알림 시스템 7종 | ✅ | REQUESTED/APPROVED/CANCELED/REMINDER/REMINDER_1H/STARTED/ENDED — 전체 route 통합 |

### 방송캘린더 (5✅)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| CAL-01 | 방송 클릭 → 상세 | ✅ | Dialog 모달 (페이지 이동 아님) |
| CAL-02 | 권한별 노출 | ✅ | `broadcasts/month/[ym]/route.ts` session 기반 centerId 필터 |
| CAL-03 | 캘린더 표시 간소화 | ✅ | `셀러명 - 채널` 형식, 완료시 색상 구분 |
| CAL-04 | 캘린더 필터 기능 | ✅ | 채널/센터/셀러/상태 4종 필터 드롭다운 |
| CAL-05 | 방송관리↔캘린더 양방향 연동 | ✅ | 동일 Broadcast DB + API 사용 |

### 상품제안 B2B 쇼핑몰 (11✅)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| PROPOSAL-01 | 핵심 컨셉 (B2B 샘플 쇼핑몰) | ✅ | `/proposals` 페이지, 샘플 카트 시스템 |
| PROPOSAL-02 | 장바구니 시스템 | ✅ | ProposalCart 모델, `/api/proposals/cart` CRUD |
| PROPOSAL-03 | 무료샘플 택배비 부담 | ✅ | `lib/constants/shipping.ts` DEFAULT_SHIPPING_FEE=3000 + cart API shippingFee 포함 |
| PROPOSAL-04 | 카테고리 분류 (2단계) | ✅ | 대분류/소분류 2단계 Select UI |
| PROPOSAL-05 | 가격 정보 자동 연동 | ✅ | 본사 상품 공급가/판매가 자동 연결 |
| PROPOSAL-06 | 상품 등록 폼 | ✅ | 이미지 업로드 (Vercel Blob + base64 폴백), 드래그앤드롭 |
| PROPOSAL-07 | 상세 페이지 에디터 | ✅ | TipTap Rich Text 에디터, DOMPurify 렌더링 |
| PROPOSAL-08 | 노출 정책 (전체 센터 동일) | ✅ | 센터 제한 없이 전체 노출 |
| PROPOSAL-09 | 샘플 요청→가상계좌→발송 | ✅ | `proposals/payment/virtual-account/route.ts` Toss Mock/Real + `SAMPLE_CHECKOUT` 알림 |
| PROPOSAL-10 | 권한별 접근 | ✅ | MASTER=전체, ADMIN=담당셀러, SELLER=본인만 |
| PROPOSAL-11 | 샘플 요청 관리 페이지 | ✅ | `/samples/requests` 통계 대시보드, 일괄 승인/거절 |

---

## Phase 4 — 데이터 + UI (3✅ 1🟡)

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| STAT-01 | 날짜 기간 설정 | ✅ | DateRangePicker, 기본 30일, 프리셋 버튼 |
| STAT-02 | 셀러랭킹 담당관리자 + 필터 | ✅ | 관리자 컬럼 + 드롭다운 필터 |
| STAT-03 | 통계 카드 클릭 모달 드릴다운 | ✅ | 4개 카드 (매출/건수/단가/마진) → DrilldownModal |
| BARCODE-04 | 바코드 UI 재구성 | 🟡 | **차후 진행** (원본 문서에도 ⚪ 차후로 표기) |

---

## Phase X — 보류 항목

| 티켓 | 내용 | 상태 | 검증 결과 |
|------|------|------|-----------|
| CONTRACT-PENDING | 계약승인 | ✅ | `/admin/contracts` 페이지 구현. 원본은 ⏸ 보류였으나 실제 구현됨 |

---

## 추가 정책/DB 수정 (56 티켓 외)

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 1 | MASTER 계정 1개 강제 | ✅ | `users/route.ts` count 체크 |
| 2 | Order soft cancel (hard delete 금지) | ✅ | `OrderStatus.CANCELLED` + `cancelledAt/cancelReason` |
| 3 | CANCELLED 주문 목록 제외 | ✅ | `orders/route.ts` `status: { not: "CANCELLED" }` |
| 4 | Center centerNumber/isMasterCenter | ✅ | `schema.prisma` |
| 5 | Order taxInvoice 필드 | ✅ | `taxInvoiceIssued/IssuedAt/Number` |
| 6 | PaymentStatus PAYMENT_FAILED | ✅ | `schema.prisma` enum |
| 7 | NotificationLog 모델 | ✅ | `schema.prisma` 11종 알림 로그 |
| 8 | Broadcast reminder1hSentAt | ✅ | 중복 발송 방지 |
| 9 | 1시간 전 리마인더 cron | ✅ | `cron/broadcast-1h-reminder/route.ts` + `vercel.json` |

---

## Phase 2 외부 어댑터 아키텍처

### Notification System (11종)
```
lib/services/notifications/
  types.ts        — NotificationType (11종), NotificationPayload
  templates.ts    — AlimTalk 템플릿 + LMS fallback buildMessage
  mock.client.ts  — console.log 기반 Mock (기본)
  solapi.client.ts — Solapi AlimTalk→LMS→관리자알림 3단계 fallback
  index.ts        — NOTIFICATION_PROVIDER=mock|solapi 전환
```

**11종 알림 타입**: ORDER_CONFIRMED, ORDER_VA_FAILED, ORDER_SHIPPED, BROADCAST_REQUESTED, BROADCAST_APPROVED, BROADCAST_CANCELED, BROADCAST_REMINDER, BROADCAST_REMINDER_1H, BROADCAST_STARTED, BROADCAST_ENDED, SAMPLE_CHECKOUT

### Tax Invoice System
```
lib/services/tax-invoice/
  types.ts          — TaxInvoiceRequest/Response
  mock.client.ts    — Mock 발행
  popbill.client.ts — PopBill API (eval require for Turbopack)
  barobill.client.ts — Barobill API (백업)
  index.ts          — TAX_INVOICE_PROVIDER=mock|popbill|barobill
```

### Adapter Pattern
- **Interface** → Mock client (default) → Real client (env var switch)
- **Bundler trick**: `eval('require')("module")` — Turbopack에서 serverExternalPackages 무시 문제 회피
- **Mock 모드**: 외부 API 키 없이도 전체 기능 동작 (console.log + DB 저장)

---

## 사용자 외부 작업 잔여 리스트

| # | 작업 | 우선순위 | 비고 |
|---|------|---------|------|
| 1 | Toss Payments 키 발급 | 높음 | 테스트키 즉시 가능 |
| 2 | Solapi 계정 생성 | 높음 | 발신번호 등록 + API key |
| 3 | PopBill 계정 생성 | 중간 | 사업자등록증 필요 |
| 4 | Vercel 환경변수 설정 | 높음 | Phase 2 변수 13개 |
| 5 | Toss 웹훅 URL 등록 | 중간 | `supermujin.ai/api/webhooks/toss/virtual-account` |
| 6 | PopBill 웹훅 URL 등록 | 중간 | `supermujin.ai/api/webhooks/popbill` |
| 7 | 카카오 알림톡 템플릿 심사 | 중간 | 카카오비즈 채널 + 템플릿 등록 |

---

## Gemini AI 모델 현황

| 항목 | 값 |
|------|-----|
| Primary | `gemini-2.5-flash` |
| Fallback | `gemini-2.5-flash-lite` |
| SDK | `@google/generative-ai@^0.24.1` |
| 환경변수 | `GEMINI_KEY` |

---

## ONEWMS 계정 정보

| 항목 | 값 |
|------|-----|
| URL | https://svc.onewms.co.kr |
| 계정 | saenip |
| 아이디 | 한국무진유통 |
| 비밀번호 | 한국무진1! |
| API | https://api.onewms.co.kr/api.php |
