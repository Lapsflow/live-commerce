# live-commerce — 프로젝트 설정

> 프로젝트 전용 환경 정보를 기록합니다. 코딩 원칙은 `CLAUDE.md` (Boris's Principles) 참고.

---

## 🎯 프로젝트 목적

Live commerce platform with ONEWMS integration, multi-marketplace support (Coupang, Naver), and AI-powered broadcast analysis.
라이브 커머스 플랫폼: ONEWMS 재고 통합, 마켓플레이스 연동, AI 방송 분석.

---

## 📍 현재 작업 상태

```
브랜치    : main
현재 작업 : 기획서 v2 매핑 + 권한 격리 핫픽스 완료
다음 작업 : 테스트 계정 정리 + 신윤송 중복 처리
블로커    : 없음
```

---

## 🔑 프로젝트 전용 환경변수

```bash
# 공통 인프라
DATABASE_URL=                  # Neon PostgreSQL (live-commerce DB)
NEXTAUTH_SECRET=               # openssl rand -base64 32
NEXTAUTH_URL=                  # http://localhost:3000 (dev)

# 통합 서비스
ONEWMS_API_KEY=                # ONEWMS API 키
COUPANG_ACCESS_KEY=            # Coupang marketplace
COUPANG_SECRET_KEY=
NAVER_CLIENT_ID=               # Naver commerce
NAVER_CLIENT_SECRET=
ANTHROPIC_API_KEY=             # Claude AI 분석
GOOGLE_SHEETS_API_KEY=         # Google Sheets 동기화
```

---

## 🗄️ 핵심 DB 모델

```
Product          — 상품 정보 (단품, 세트)
ProductSet       — 세트 상품 구성
BOM              — 자재 명세서
Order            — 주문 (Coupang, Naver, 직접)
OrderProduct     — 주문 상품
OrderCS          — CS 처리 내역
Broadcast        — 라이브 방송 정보
Sale             — 판매 실적
Center           — 센터 (지역/운영 단위)
User             — 사용자 (centerId 연결)
Inventory        — 재고 관리
Supplier         — 공급업체
[12+ models total]
```

전체 스키마: `prisma/schema.prisma`

---

## 📁 라우트 구조

```
/                         → redirect to /login
/login                    → NextAuth credentials

/(main)/ [인증 필요]
├── /products             → 상품 관리
├── /orders               → 주문 관리
├── /broadcasts           → 방송 관리
├── /sales                → 판매 실적
├── /inventory            → 재고 관리
├── /suppliers            → 공급업체 관리
├── /centers              → 센터 관리 (MASTER only)
└── /users                → 사용자 관리

/api/ [서버리스]
├── /auth/[...nextauth]   → NextAuth (절대 수정 금지)
├── /products             → Product CRUD
├── /orders               → Order CRUD
├── /broadcasts           → Broadcast CRUD
├── /onewms               → ONEWMS webhook
├── /coupang              → Coupang 통합
├── /naver                → Naver 통합
└── /cron                 → Vercel cron jobs
```

---

## 📦 특수 통합

### ONEWMS
- 위치: `lib/services/onewms/`
- 기능: 재고, 주문, 배송 관리
- Webhook: `/api/onewms/webhook`

### 마켓플레이스
- Coupang: `lib/marketplaces/coupang/`
- Naver: `lib/marketplaces/naver/`
- 자동 주문 동기화, 재고 업데이트

### AI 분석
- Claude API: `lib/ai/`
- 방송 스크립트 분석
- 판매 예측

### Google Sheets
- 위치: `lib/services/sheets/`
- 기능: 재고/판매 데이터 동기화

---

## ⚠️ 절대 건드리지 말 것

```
app/api/auth/              → NextAuth 핸들러
prisma/migrations/         → 마이그레이션 히스토리
lib/db/prisma.ts           → Neon adapter 설정
lib/api/create-crud-handler-prisma.ts → CRUD factory 핵심
lib/services/onewms/       → ONEWMS 통합 (주의해서 수정)
.env                       → 절대 커밋 금지
```

---

## 🚧 알려진 기술 부채

```
[ ] [프로젝트 백로그 참조]
```

---

## 📋 작업 계획

```
[x] 기획서 v2 PDF 매핑
[x] 권한 격리 핫픽스 (ONEWMS / 자동등록 뱃지)
[x] 사용자 비활성화 UI
[x] 상품 관리 센터 권한 격리
[x] 발주 엑셀 업로드 WMS 매칭 안내
[x] 보리스 원칙 적용 + 하네스 제거
[ ] 테스트 계정 일괄 삭제 스크립트 실행
[ ] 신윤송 중복 entry 정리
```

---

_최초 작성: 2026-04-15 | 마지막 업데이트: 2026-04-15_
