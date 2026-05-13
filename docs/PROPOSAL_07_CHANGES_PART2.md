# PROPOSAL-07 Part 2: 명명 통일 + 통합 발주서 화면

> 작성: 2026-05-12 | 기획서 v2 PDF 매핑 결과 + 대표님 추가 답변 반영

## 요약

대표님 답변에 따른 후속 작업 2건:

| # | 결정 | 작업 |
|---|------|------|
| 1 | A — 명명을 "센터관리자"로 통일 | `ROLE_LABELS` 매핑 변경 + 하드코딩 1곳 정리 |
| 2 | B — 셀러 화면 본사/센터 라벨 유지 | 작업 없음 (이미 그대로) |
| 3 | B — 통합 발주서 화면 신설 | `/orders/by-broadcast` 페이지 + API 추가 |

---

## 1. ROLE_LABELS 통일

### 변경 파일
- `lib/constants/role-labels.ts` — 라벨 매핑 변경
- `components/users/user-add-dialog.tsx` — 하드코딩 "센터 관리자" → ROLE_LABELS 참조

### 변경 내용
```
MASTER     : "전체관리자"  →  "마스터(본사)"
SUB_MASTER : "관리자"     →  "센터관리자"
SELLER     : "셀러"       (변경 없음)
```

### 자동 반영되는 위치
이미 ROLE_LABELS를 사용하는 모든 화면에서 자동으로 새 라벨 표시:
- `components/users/role-badge.tsx` (RoleBadge 컴포넌트)
- `components/users/user-edit-dialog.tsx`
- 사용자 목록 페이지 `/users` (RoleBadge 사용)

### 변경 안 한 부분
- `Role` enum 자체 (`MASTER` / `SUB_MASTER` / `SELLER`) — DB와 API 호환성 유지
- 권한 체크 로직 (`role === "SUB_MASTER"`) — 모두 그대로

---

## 2. 셀러 화면 본사/센터 라벨

대표님이 B (그대로 유지) 선택 → **변경 작업 없음**.

방송 중 상품 목록의 "본사 (배송·사고: 본사)" / "센터 (배송·사고: 센터)" 뱃지는 현재 그대로 유지됩니다.

---

## 3. 방송별 통합 발주서 화면 신설

기획서 v2 6페이지의 "OO방송 / △△센터 제품 X개 + 본사 제품 Y개" 형태를 구현.

### 신규 파일
- `app/api/orders/by-broadcast/route.ts` — GET API
- `app/(main)/orders/by-broadcast/page.tsx` — 화면

### 변경 파일
- `components/layout/sidebar.tsx` — MASTER 메뉴에 "방송별 통합 발주서" 추가

### 데이터 흐름
1. 같은 `broadcastId`를 가진 모든 `Order` 조회
2. broadcastId 기준 그룹핑
3. 각 그룹 내 `OrderItem`을 `productType` 별로 분류 (HEADQUARTERS / CENTER)
4. 합계 계산: 본사 제품 수량/금액, 센터 제품 수량/금액

### UI 구성
- 상단 필터: 시작일 / 종료일 / 발주 상태
- 요약 카드 4개: 방송 수, 발주 건수, 본사 제품 합계, 센터 제품 합계
- 본문 카드 리스트: 각 방송별로
  - 방송 제목 + 시각 + 셀러
  - "통합 발주서" 박스에 "본사 제품 X개 + 센터 제품 Y개 (센터명 목록)" 표시
  - 본사 매출 / 센터 매출 별도 표시
  - 관여 센터 코드 뱃지

### 권한
- `MASTER`만 접근 가능
- 다른 권한 사용자가 직접 URL 진입 시 `/dashboard`로 리다이렉트

### 사이드바
- MASTER 메뉴에 "발주 관리" 바로 아래 "방송별 통합 발주서" 추가
- 아이콘: Radio (방송 아이콘)

---

## 검증

### 빌드
- `tsc --noEmit --skipLibCheck` → 에러 없음
- `eslint` → 기존 프로젝트 `any` 패턴과 동일, 회귀 없음

### Playwright 검증 필요
- `customer-acceptance-2026-05-12.spec.ts` (신규)
- 라벨 변경 + 통합 발주서 화면 + 회귀 점검

---

## 배포 후 확인할 운영 화면 (3개)

1. `https://www.supermujin.ai/users` — 사용자 권한 뱃지가 "센터관리자" / "마스터(본사)"로 표시
2. `https://www.supermujin.ai/orders/by-broadcast` — 새 메뉴 진입 + 통합 발주서 카드 표시
3. 사이드바 MASTER 메뉴에 "방송별 통합 발주서" 가시

---

## 변경 파일 목록

```
M  lib/constants/role-labels.ts
M  components/users/user-add-dialog.tsx
M  components/layout/sidebar.tsx
A  app/api/orders/by-broadcast/route.ts
A  app/(main)/orders/by-broadcast/page.tsx
A  docs/PROPOSAL_07_CHANGES_PART2.md  (본 문서)
```
