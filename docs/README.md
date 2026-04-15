# Live Commerce Platform - 문서 인덱스

> 라이브커머스 플랫폼 통합 문서 가이드

---

## 📚 문서 구조

```
docs/
├── 01-plan/              # 계획 문서 (Plan Phase)
├── 02-design/            # 설계 문서 (Design Phase)
├── 03-analysis/          # 분석 문서 (Check Phase)
├── 04-report/            # 완료 보고서 (Act Phase)
├── api/                  # API 레퍼런스
├── deployment/           # 배포 가이드
├── operation/            # 운영 가이드
├── security/             # 보안 문서
└── performance/          # 성능 최적화
```

---

## 🎯 주요 문서 바로가기

### 📋 개발 프로세스 (PDCA)

| Phase | 문서 | 설명 |
|-------|------|------|
| **Plan** | [01-plan/features/](./01-plan/features/) | 기능별 계획 문서 |
| **Design** | [02-design/features/](./02-design/features/) | 상세 설계 문서 |
| **Check** | [03-analysis/](./03-analysis/) | Gap 분석 보고서 |
| **Act** | [04-report/](./04-report/) | 완료 보고서 |

---

### 🚀 빠른 시작

**처음 사용하시나요?**
1. [프로젝트 개요](../README.md) - 시스템 소개 및 기술 스택
2. [배포 가이드](./deployment/deployment-guide.md) - 로컬 설정부터 프로덕션까지
3. [API 레퍼런스](./api/api-reference.md) - 전체 API 엔드포인트 문서

**개발자이신가요?**
1. [성능 최적화 가이드](./performance/optimization-guide.md) - 성능 목표 및 최적화 전략
2. [보안 모범 사례](./security/security-best-practices.md) - 보안 가이드라인
3. [운영 가이드](./operation/operation-guide.md) - 모니터링 및 장애 대응

---

## 📖 문서 카테고리별 가이드

### 1. 개발 계획 및 설계

#### Plan (계획)
- **경로**: `01-plan/features/`
- **내용**: 기능별 요구사항, 범위, 마일스톤
- **주요 문서**:
  - `live-commerce-migration.plan.md` - 전체 마이그레이션 계획
  - `onewms-integration.plan.md` - ONEWMS 통합 계획

#### Design (설계)
- **경로**: `02-design/features/`
- **내용**: 데이터베이스 스키마, API 설계, UI/UX 구조
- **주요 문서**:
  - `onewms-integration.design.md` - ONEWMS API 상세 설계

#### Analysis (분석)
- **경로**: `03-analysis/`
- **내용**: Gap 분석, Match Rate, 개선사항
- **주요 문서**:
  - `onewms-integration.analysis.md` - ONEWMS 통합 분석 (96% match)

#### Report (보고서)
- **경로**: `04-report/`
- **내용**: PDCA 완료 보고서, 성과 요약
- **주요 문서**:
  - `onewms-integration.report.md` - ONEWMS 통합 완료 보고서

---

### 2. API 문서

**API Reference**: [api/api-reference.md](./api/api-reference.md)

**카테고리별 API**:
- **User Management**: 사용자 관리, 인증
- **Product & Inventory**: 상품, 재고 관리
- **Order Management**: 발주, 주문 처리
- **Center Management**: 센터 관리 (Phase 1)
- **ONEWMS Integration**: WMS 연동 API
- **Marketplace Pricing**: 네이버/쿠팡 시세 조회 (Phase 2)
- **AI Analysis**: Claude API 기반 분석 (Phase 2)
- **Sample Shopping**: 샘플 발주 시스템 (Phase 5)

---

### 3. 배포 가이드

**Deployment Guide**: [deployment/deployment-guide.md](./deployment/deployment-guide.md)

**주요 내용**:
- 로컬 개발 환경 설정
- 환경변수 관리
- Vercel 배포 프로세스
- Database 마이그레이션
- CI/CD 파이프라인

---

### 4. 운영 가이드

**Operation Guide**: [operation/operation-guide.md](./operation/operation-guide.md)

**주요 내용**:
- 시스템 모니터링
- 로그 관리
- 장애 대응 프로세스
- 백업 및 복구
- 성능 튜닝

---

### 5. 보안 문서

**Security Documentation**: [security/README.md](./security/README.md)

**주요 문서**:
- [보안 감사 보고서](./security/security-audit.md) - 취약점 분석 및 개선 로드맵
- [보안 모범 사례](./security/security-best-practices.md) - 개발 및 운영 보안 가이드

**보안 점수**: 71/100 (보통)
**치명적 취약점**: Rate Limiting 미구현, CSRF 보호 부재

---

### 6. 성능 최적화

**Performance Guide**: [performance/optimization-guide.md](./performance/optimization-guide.md)

**성능 목표**:
- API 응답 시간: p95 < 2000ms, p50 < 500ms
- 페이지 로드: FCP < 1.8s, LCP < 2.5s
- Lighthouse 점수: Performance > 90

**주요 최적화**:
- Database 인덱싱 전략
- Redis 캐싱 (Upstash)
- Next.js 설정 최적화
- 코드 스플리팅 및 이미지 최적화

---

## 🔍 Phase별 구현 문서

| Phase | 주제 | 완료 | 문서 위치 |
|-------|------|------|----------|
| **Phase 0** | 준비 및 환경 설정 | ✅ | - |
| **Phase 1** | 센터 기반 인프라 구축 | ✅ | `01-plan/features/center-system.md` |
| **Phase 2** | 바코드 운영 시스템 | ✅ | `01-plan/features/barcode-system.md` |
| **Phase 3** | 발주 자동화 시스템 | ✅ | `01-plan/features/order-automation.md` |
| **Phase 4** | 방송 캘린더 고도화 | ✅ | `01-plan/features/broadcast-calendar.md` |
| **Phase 5** | 샘플 발주 시스템 | ✅ | `01-plan/features/sample-ordering.md` |
| **Phase 6** | 테스트 및 안정화 | ✅ | 본 문서 참조 |

---

## 📊 시스템 아키텍처

### Technology Stack

**Frontend**:
- Next.js 16 (App Router) + React 19
- shadcn/ui + Tailwind CSS 4
- TanStack Table, Recharts, SWR

**Backend**:
- Next.js API Routes (Serverless)
- Prisma 7 + Neon PostgreSQL
- NextAuth v5 (JWT)

**External Integrations**:
- ONEWMS API (WMS)
- Naver Shopping API (시세 조회)
- Coupang API (시세 조회)
- Claude API (AI 분석)
- SendGrid (이메일 알림)
- Toss Payments (가상계좌 발급)

**Infrastructure**:
- Vercel (Hosting + CDN)
- Neon (PostgreSQL)
- Upstash Redis (Caching + Rate Limiting)

---

## 🛠️ 유용한 명령어

### 개발 환경
```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

### 데이터베이스
```bash
# Prisma 클라이언트 생성
npx prisma generate

# 마이그레이션 실행
npx prisma migrate dev

# 데이터베이스 시드
npm run prisma:seed
```

### 테스트
```bash
# E2E 테스트 (전체)
npm run test:e2e

# E2E 테스트 (통합 테스트만)
npm run test:e2e:integration

# E2E 테스트 (UI 모드)
npm run test:e2e:ui
```

### 보안 및 성능
```bash
# 환경변수 검증
npx tsx scripts/security/validate-env.ts

# npm 취약점 스캔
npm audit

# API 성능 벤치마크
npx tsx scripts/performance/api-benchmark.ts

# 데이터베이스 인덱스 확인
psql $DATABASE_URL -f scripts/performance/check-indexes.sql
```

---

## 📞 문의 및 지원

### 기술 지원
- **보안 이슈**: security@your-company.com
- **버그 리포트**: GitHub Issues (비공개)
- **긴급 장애**: 운영팀 직접 연락

### 문서 개선
문서 개선 제안이 있으시면 PR을 생성해주세요.

---

## 📝 변경 이력

| 날짜 | 버전 | 주요 변경사항 |
|------|------|--------------|
| 2026-04-14 | 1.0.0 | Phase 6 완료 - 프로덕션 배포 준비 완료 |
| 2026-04-13 | 0.9.0 | Phase 5 완료 - 샘플 발주 시스템 |
| 2026-04-12 | 0.8.0 | Phase 4 완료 - 방송 캘린더 고도화 |
| 2026-04-11 | 0.7.0 | Phase 3 완료 - 발주 자동화 |
| 2026-04-10 | 0.6.0 | Phase 2 완료 - 바코드 운영 시스템 |
| 2026-04-09 | 0.5.0 | Phase 1 완료 - 센터 기반 인프라 |
| 2026-04-09 | 0.4.0 | ONEWMS Integration 완료 (96% match) |

---

**Last Updated**: 2026-04-14
**Maintained By**: Development Team
