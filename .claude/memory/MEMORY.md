# Live-Commerce 프로젝트 메모리

## 프로젝트 개요
- **목적**: Google Apps Script 라이브커머스 시스템을 Next.js로 완전 마이그레이션
- **기술 스택**: Next.js 16 + React 19 + Neon PostgreSQL + Vercel
- **코드 재사용**: Hyudo ERP 검증된 컴포넌트 활용
- **현재 상태**: PDCA Plan 단계 완료 (2026-04-05)

## 원본 시스템 분석 (v2.5)
- **플랫폼**: Google Apps Script + Google Sheets
- **핵심 기능**: 바코드 스캔, 발주관리, 방송일정, 판매현황, 권한관리
- **사용자 역할**: 마스터, 부마스터, 관리자, 셀러 (4단계)
- **제한사항**: Google Sheets 성능 한계, UI/UX 제약, 확장성 부족

## 목표 시스템 설계
- **데이터베이스**: Neon PostgreSQL (6개 핵심 테이블)
  - User (사용자/권한)
  - Product (상품/재고)
  - Order + OrderItem (발주)
  - Broadcast (방송일정)
  - Sale (판매현황)
- **주요 기능**: 4대 핵심 기능 완전 구현
  1. FR-01: 사용자 인증 및 권한 관리 (RBAC)
  2. FR-02: 바코드 스캔 + 재고 조회 (<100ms 응답)
  3. FR-03: 발주 관리 (Excel 업로드)
  4. FR-04: 방송 일정 관리
  5. FR-05: 판매 현황 조회 (차트)

## Hyudo ERP 재사용 컴포넌트
- **인증**: NextAuth v5 + bcrypt + 역할 기반 접근제어
- **CRUD API**: `create-crud-handler-prisma.ts` 팩토리
- **DataTable**: TanStack Table v8 (정렬/필터/페이지네이션/CSV)
- **shadcn/ui**: base-nova 테마 + 40+ 컴포넌트

## 개발 일정 (4주)
- **Week 1**: 프로젝트 설정 + 인증 (NextAuth)
- **Week 2**: 바코드 스캔 + 발주 관리
- **Week 3**: 방송 일정 + 판매 현황
- **Week 4**: 데이터 마이그레이션 + Vercel 배포

## 성공 기준
- 4대 핵심 기능 100% 동작
- 바코드 조회 응답 <100ms
- Lighthouse 성능 90+ 점
- 베타 테스트 만족도 80% 이상

## 다음 단계
- `/pdca design live-commerce-migration` - Design 문서 작성
- Prisma 스키마 설계
- 컴포넌트 아키텍처 정의

## Common Pitfalls (재사용 경험)
- Neon HTTP adapter: `$transaction()` 미지원 → direct queries 사용
- NextAuth v5 Vercel: `trustHost: true` 필수
- Prisma 7: generator `prisma-client`, output `/client` 명시
- shadcn base-nova: `asChild` 없음 → `className={buttonVariants()}` 패턴
