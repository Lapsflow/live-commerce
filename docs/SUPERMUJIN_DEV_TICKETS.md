# 슈퍼무진 사이트 수정 요청 현황

> 최종 업데이트: 2026-04-28

## 요약

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 0 | 도메인 SSL (www 리다이렉트) | **보류** | Vercel 대시보드에서 수동 설정 필요 |
| 1 | 통계 | **보류** | 요구사항 구체화 필요 |
| 2-1 | 회원가입 비밀번호 확인 | **완료** | passwordConfirm 필드 추가 |
| 2-2 | 비밀번호 변경 | **완료** | API + 설정 페이지 |
| 3-1 | 사용자 활성/비활성 | **완료** | isActive 필드 + 로그인 차단 + UI 토글 |
| 3-2 | 사용자별 상품 보기 | **미구현** | 사용자 상세에 취급 상품 탭 추가 필요 |
| 3-3 | 발주 엑셀 다운로드 | **완료** | 슈퍼무진/자사몰 주문서 버튼 |
| 4 | 계약 승인 동작 안함 | **완료** | /api/admin/contracts 전용 API |
| 5 | 발주 관리 JSON 오류 | **완료** | null-safe 처리 (삭제된 사용자/상품) |
| 6 | 캘린더 방송 코드 → 방송인 이름 | **완료** | seller.name 표시 |
| 7 | 상품 센터 선택 | **미구현** | 센터별 필터 UI 추가 필요 |
| 8 | 쇼핑몰 | **보류** | 범위가 넓어 별도 프로젝트로 분리 |
| 9 | 바코드 재고 불일치 | **완료** | LOOKUP 시 자동 정합성 보정 |
| 10 | 바코드 네이버 이미지 미표시 | **완료** | PricingInfoCard에 상품 이미지 추가 |

**완료: 9/11 | 미구현: 2/11 | 보류: 3/11**

---

## 완료된 항목 상세

### #2-1 회원가입 비밀번호 확인
- **파일**: `app/(auth)/signup/page.tsx`
- **내용**: passwordConfirm state 추가, 실시간 일치/불일치 표시, 서버 유효성 검증

### #2-2 비밀번호 변경
- **파일**: `app/api/auth/change-password/route.ts` (신규), `app/(main)/settings/page.tsx` (신규)
- **내용**: 현재 비밀번호 확인 후 새 비밀번호로 변경. 사이드바에 "비밀번호 변경" 링크 추가

### #3-1 사용자 활성/비활성
- **파일**: `prisma/schema.prisma`, `lib/auth.ts`, `app/(main)/users/page.tsx`
- **내용**: User 모델에 `isActive` 필드 추가. 비활성 계정 로그인 차단. 사용자 목록에서 활성/비활성 토글 버튼

### #3-3 발주 엑셀 다운로드
- **파일**: `app/(main)/orders/page.tsx`, `app/api/orders/export/route.ts`
- **내용**: "슈퍼무진 주문서", "자사몰 주문서" 버튼으로 엑셀 다운로드. type=wms/center 파라미터

### #4 계약 승인
- **파일**: `app/api/admin/contracts/route.ts` (신규), `app/(main)/admin/contracts/page.tsx`
- **내용**: PENDING 셀러 전용 API 생성. 기존 /api/users는 role/contractStatus 필터 미지원이어서 별도 API로 분리

### #5 발주 관리 JSON 오류
- **파일**: `app/api/orders/route.ts`, `app/(main)/orders/page.tsx`
- **내용**: 삭제된 셀러/상품에 대해 null-safe 처리. `삭제된 사용자`, `삭제된 상품`으로 기본값 반환

### #6 캘린더 방송인 이름
- **파일**: `app/(main)/broadcasts/calendar/page.tsx`
- **내용**: 캘린더 이벤트 타이틀을 방송 코드에서 `seller.name`으로 변경

### #9 바코드 재고 불일치
- **파일**: `app/api/inventory/scan/route.ts`
- **내용**: LOOKUP 모드에서 센터별 재고 합계와 totalStock 비교, 불일치 시 자동 보정

### #10 바코드 네이버 이미지
- **파일**: `app/(main)/barcode/components/PricingInfoCard.tsx`
- **내용**: 네이버 상품 목록에 이미지 썸네일 추가 (API는 image URL 반환하지만 렌더링 누락이었음)

---

## 미구현 항목

### #3-2 사용자별 상품 보기
- **현재 상태**: `app/(main)/users/[id]/page.tsx`에 방송/판매/주문/관리셀러 탭만 존재
- **필요 작업**: "취급 상품" 탭 추가. 해당 셀러의 주문 상품 목록 조회 API 연동

### #7 상품 센터 선택
- **현재 상태**: 상품 목록에 productType(본사/센터) 필터만 존재. 센터별 필터 UI 없음
- **필요 작업**: 센터 선택 드롭다운 추가, 선택한 센터의 상품만 필터링

---

## 보류 항목

### #0 도메인 SSL (www 리다이렉트)
- **사유**: Vercel 대시보드에서 www.supermujin.ai 도메인을 수동으로 추가해야 함
- **작업**: Vercel Dashboard → Settings → Domains → www.supermujin.ai 추가 (자동 리다이렉트)

### #1 통계
- **사유**: 요구사항이 구체적이지 않아 추가 논의 필요

### #8 쇼핑몰
- **사유**: 범위가 넓어 별도 프로젝트로 분리 (전체 이커머스 플랫폼 구축 수준)
