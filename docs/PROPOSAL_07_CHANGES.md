# PROPOSAL-07: 센터 등록 단순화 + 상품제안 쇼핑몰화

> 작성: 2026-05-10 | 슈퍼무진 수정 요청 대응

## 요약

| # | 요청 | 처리 |
|---|------|------|
| 1 | 센터 추가 흐름 단순화 (별도 관리자 추가 절차 제거) | 완료 |
| 2-1 | 마스터 업로드는 승인/거절 없이 즉시 노출 | 완료 |
| 2-2 | 새 제안 등록 시 이미지 업로드 안 됨 (버그) | 완료 |
| 2-3 | 상품제안을 카테고리별 카드 그리드로 (쇼핑몰형) | 완료 |

---

## 1. 센터 등록 단순화

### 변경 파일
- `app/(main)/admin/centers/components/CenterForm.tsx`
- `app/(main)/admin/centers/new/page.tsx`
- `app/api/centers/route.ts`

### 변경점
- 관리자 입력 필드 5개 → **2개 (아이디, 비밀번호)** 로 축소
- 관리자 이름은 **센터 대표자 이름 자동 사용** (Q1 답변 A안)
- 관리자 연락처는 대표자 연락처 자동 사용
- 관리자 이메일 입력칸 제거
- 관리자 계정을 **선택 → 필수**로 변경 (센터=계정 1:1)
- "관리자 계정" → "센터 로그인 계정"으로 라벨 변경 (인지 단순화)
- 결과 화면에서도 동일하게 노출 정보 정리

### 흐름 (변경 후)
```
센터관리 메뉴 → [센터추가] 버튼
  → 새 센터 등록 화면 (단일 페이지)
    1. 센터코드 (지역 + 폰뒤4자리 자동)
    2. 기본 정보 (센터명/대표자/연락처/주소/사업자번호)
    3. 센터 로그인 계정 (아이디/비밀번호)  ← 필수
  → [생성] → 결과 화면에서 계정 정보 복사
```

---

## 2-1. 승인/거절 절차 제거 (마스터 업로드)

### 변경 파일
- `app/api/proposals/route.ts`

### 변경점
- POST 핸들러: `userRole === "MASTER"`인 경우 `status: "APPROVED"`로 즉시 저장
- (POST 핸들러 자체가 이미 MASTER 전용 권한이므로 사실상 모든 신규 제안이 즉시 노출됨)
- 카드 UI에서는 승인/거절 버튼 자체를 노출하지 않음 (기존 리스트 UI는 전면 재작성됨)

### 영향
- 기존 PENDING 상태로 남아있는 데이터가 있다면 별도 정리 필요 (수동 SQL 또는 UI 추가 필요시 알려주세요)

---

## 2-2. 이미지 업로드 버그 수정

### 변경 파일
- `app/api/uploads/route.ts`

### 원인
`req.formData()`가 try 블록 내부에서 한 번 호출된 뒤, BLOB 토큰 미설정 fallback 경로에서 **다시 호출**되었음. FormData는 한 번 읽으면 소진되어 두 번째 호출은 실패 → 결국 500 에러로 빠짐.

### 수정
- FormData 파싱을 try 블록 밖으로 이동, `file` 변수를 한 번만 추출
- Blob 업로드 실패 시 base64 data URL fallback이 동일한 file 변수를 재사용
- 모든 에러 케이스 (BLOB 토큰 미설정, 네트워크, 권한 등)에서 fallback 경로 정상 동작

### 운영 권장
- Vercel 프로덕션에는 `BLOB_READ_WRITE_TOKEN` 환경변수 설정 권장 (없어도 base64로 동작은 하지만 DB 용량 증가)

---

## 2-3. 상품제안 쇼핑몰형 카드 UI

### 변경 파일
- `app/(main)/proposals/page.tsx` (전면 재작성)
- `prisma/schema.prisma` (Proposal 모델 필드 추가)
- `prisma/migrations/20260510021744_add_proposal_pricing_fields/migration.sql` (신규)

### 신규 DB 필드 (Proposal 모델)
| 필드 | 타입 | 비고 |
|------|------|------|
| `onlineLowestPrice` | Int? | 온라인 최저가 (원) |
| `supplyPrice` | Int? | 공급가 (원) |
| `expiryDate` | DateTime? | 유통기한 (Q2 답변: 날짜 형식 YYYY-MM-DD) |
| `stockQty` | Int? | 재고 갯수 |

> 모두 NULL 허용 (Q3 답변: 선택 입력). `category` 인덱스도 함께 추가 (그룹 조회 성능).

### UI 구조
1. **카테고리 탭** — 전체/식품/뷰티/생활주방/가전/패션/기타 (각 탭에 카운트 뱃지)
2. **카테고리별 그룹 섹션** — 같은 카테고리 카드들이 한 묶음으로 표시
3. **카드 그리드** — 1/2/3/4 열 반응형
4. **상세 모달** — 카드 클릭 시 큰 이미지 + 모든 정보 + 서브이미지 5장 표시

### 카드 표시 정보 (요청하신 7가지)
- 메인 이미지 (이미지 없으면 placeholder 아이콘)
- 카테고리 (대분류 › 소분류)
- 제품명 (2줄까지 표시)
- 온라인 최저가 (취소선)
- 공급가 (강조 색상)
- 유통기한
- 재고 갯수 (10개 이하 시 "재고 부족" 빨간 뱃지)
- 발주 방식 뱃지: **지속발주**(녹색) / **단타성**(주황색)

### 등록 폼
- "가격 · 재고 · 유통기한" 섹션 신설 (모두 선택)
- 발주 방식 옵션 라벨 변경: SINGLE→"단타성 제품", RECURRING→"지속발주 가능"
- 이미지 업로드 후 동일 파일 재선택 가능하도록 input value 리셋
- 업로드 실패 시 사용자에게 명확한 에러 메시지 노출

---

## ⚠️ 배포 전 필수 작업

```bash
# 1. Prisma 클라이언트 재생성 (신규 필드 인식)
pnpm prisma generate

# 2. DB 마이그레이션 적용
pnpm prisma migrate deploy   # 프로덕션
# 또는
pnpm prisma migrate dev      # 로컬 (이미 마이그레이션 파일은 생성되어 있음)

# 3. 빌드 검증
pnpm tsc --noEmit && pnpm lint && pnpm build
```

> Cowork 샌드박스에서는 Prisma binaries.prisma.sh 접근이 차단되어 `prisma generate`를
> 실행하지 못했습니다. 로컬에서 위 순서대로 실행 부탁드립니다.

---

## 검증 결과 (샌드박스)

- TypeScript: 변경 파일 중 `app/api/proposals/route.ts:64`의 `expiryDate` 필드만 에러 (Prisma generate 후 자동 해결). **다른 회귀 없음**.
- ESLint: 신규 코드의 lint 이슈는 모두 기존 프로젝트 패턴 (`as any`, `<img>` 태그)과 동일 — 회귀 없음.

---

## 변경 파일 목록

```
M  app/(main)/admin/centers/components/CenterForm.tsx
M  app/(main)/admin/centers/new/page.tsx
M  app/(main)/proposals/page.tsx              (전면 재작성)
M  app/api/centers/route.ts
M  app/api/proposals/route.ts
M  app/api/proposals/[id]/status/route.ts     (auth 중복 호출 패치)
M  app/api/uploads/route.ts
M  prisma/schema.prisma
A  prisma/migrations/20260510021744_add_proposal_pricing_fields/migration.sql
A  docs/PROPOSAL_07_CHANGES.md                (본 문서)
```

---

## Hotfix: auth() 중복 호출 버그 (Session 4 검증 결과 대응)

### 발견 경위
Phase 8 Playwright 검증 중 **시나리오 #6 (POST /api/proposals → status APPROVED 검증)** 에서
`status === "APPROVED"` 대신 `"PENDING"`이 반환되는 현상 발견.

### 원인
`withRole(["MASTER"], handler)`은 이미 인증/권한 검증을 수행하고 `user: AuthUser`를
핸들러의 두 번째 파라미터로 주입한다. 그런데 핸들러 내부에서 `auth()`를 다시 호출하면
**API request 컨텍스트에서는 NextAuth 세션이 잡히지 않아** `session.user.role`이
undefined가 되고, 결과적으로 `userRole === "MASTER"` 조건이 false가 되어
`status: "PENDING"`으로 저장되었다.

### 수정 (2개 파일)
- `app/api/proposals/route.ts` (POST/GET): `auth()` 제거, `user` 파라미터 직접 사용
- `app/api/proposals/[id]/status/route.ts` (PUT): `auth()` 제거, `_user` 파라미터 사용

### 영향
- POST /api/proposals → MASTER 등록 시 status가 정확히 APPROVED로 저장
- GET / PUT 핸들러도 불필요한 auth() 호출 제거로 응답 시간 약간 개선

### ⚠️ 별도 정리 필요한 동일 패턴 (21개 파일)
프로젝트 전반에 같은 `withRole + 핸들러 내 auth()` 중복 호출 패턴이 21곳에 있음.
이번 PROPOSAL-07 범위 외라 손대지 않았으나, 별도 PR로 일괄 정리 권장:

```
app/api/orders/bulk/route.ts
app/api/orders/bulk-status/route.ts
app/api/proposals/[id]/route.ts
app/api/proposals/samples/route.ts
app/api/proposals/cart/route.ts
app/api/proposals/cart/checkout/route.ts
app/api/proposals/payment/virtual-account/route.ts
app/api/stats/admin/[id]/route.ts
app/api/stats/seller/[id]/route.ts
app/api/users/[id]/route.ts
app/api/users/[id]/stats/route.ts
app/api/broadcasts/[id]/start/route.ts
app/api/broadcasts/[id]/cancel/route.ts
app/api/broadcasts/[id]/confirm/route.ts
app/api/broadcasts/month/[ym]/route.ts
app/api/onewms/delivery/update/route.ts
app/api/onewms/orders/sync/route.ts
app/api/onewms/orders/retry/route.ts
app/api/onewms/orders/import/route.ts
app/api/onewms/products/import/route.ts
app/api/onewms/stock/conflicts/route.ts
app/api/onewms/stock/sync/route.ts
app/api/onewms/stats/route.ts
app/api/samples/route.ts
```

각 파일에서 user 정보를 사용하지 않거나, 사용해도 withRole 주입값을 신뢰하면 되므로
auth() 호출과 session.user 추출 블록을 제거하면 된다.
