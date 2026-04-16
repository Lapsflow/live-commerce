# 회원가입 시스템 설계 문서

## ID/이메일 필드 설계

### 현재 설계 (pptx 스펙 준수)
- **`username` 필드**: 로그인용 아이디 (pptx의 "아이디")
- **`email` 필드**: 실제 이메일 주소 (선택 사항)
- **로그인 방식**: username + password

### 설계 근거
1. **스펙 준수**: pptx에서 "아이디"로 명시된 필드를 username으로 구현
2. **명확성**: 로그인용 아이디와 실제 이메일을 명확히 구분
3. **유연성**: 이메일은 선택 사항으로 하여 필수 정보 최소화

### 필드 역할
- **username**: 필수, 로그인 ID, 3-50자
- **email**: 선택, 실제 이메일 주소, 이메일 형식 검증

---

## 필수 필드 정책

### 1차 필수 정보 (모든 사용자)
- 아이디 (username)
- 비밀번호
- 이름
- 휴대폰번호 (pptx 스펙)
- 센터 소속

### SELLER 추가 필수 정보
- 활동 채널 (최소 1개)
- 월 평균 방송 매출 (> 0)

### 2차 선택 정보 (SELLER, 가입 후 입력)
- 주요 판매 카테고리
- 활동 지역
- 방송 가능 시간대

---

## 센터 코드 규칙

### 형식
```
[지역코드]-[센터 대표자 휴대폰 뒷 4자리]
```

### 지역코드
- 01: 서울
- 02: 경기
- 03: 인천
- 04: 부산
- 05: 대구
- 06: 대전
- 07: 광주
- 08: 울산
- 09: 세종
- 10: 강원
- 11: 충북
- 12: 충남
- 13: 전북
- 14: 전남
- 15: 경북
- 16: 경남
- 17: 제주

### 검증 로직
- Regex: `^(0[1-9]|1[0-7])-\d{4}$`
- 센터 생성 시 자동 검증
- 회원가입 시 센터 코드 형식 확인

---

## 데이터베이스 스키마

### User 모델
```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique          // 로그인용 아이디 (pptx 스펙)
  email        String?  @unique          // 실제 이메일 (선택)
  name         String
  phone        String                     // 휴대폰번호 (필수 - pptx 스펙)
  role         Role     @default(SELLER)
  centerId     String?
  passwordHash String?
  
  // SELLER 1차 정보
  channels     String[] @default([])
  avgSales     Int?
  
  // SELLER 2차 정보 (신규 추가)
  categories   String[] @default([])     // 주요 판매 카테고리
  regions      String[] @default([])     // 활동 지역
  timeSlots    String[] @default([])     // 방송 가능 시간대
  
  // Contract 정보
  contractStatus ContractStatus @default(PENDING)
  // ... 기타 필드
}
```

---

## API 엔드포인트

### 회원가입
- **POST /api/auth/signup**
- 필수 필드: username, password, name, phone, centerId
- SELLER 필수: channels, avgSales
- SELLER 선택: categories, regions, timeSlots

### 프로필 완성
- **PATCH /api/users/[id]/profile**
- 업데이트 가능: categories, regions, timeSlots
- SELLER만 접근 가능

### 센터 생성
- **POST /api/centers**
- 센터 코드 형식 검증 필수

---

## UI 화면

### 회원가입 화면
1. **1차 필수 정보**
   - 아이디 (username)
   - 비밀번호
   - 이름
   - 휴대폰번호 (필수)
   - 이메일 (선택)
   - 센터 선택

2. **SELLER 추가 정보**
   - 활동 채널 (체크박스)
   - 월평균 매출 (숫자 입력)

3. **2차 선택 정보 (가입 후 안내)**
   - 프로필 완성 페이지로 이동 옵션 제공
   - "나중에 하기" 선택 가능

### 로그인 화면
- 아이디 (username) + 비밀번호
- "이메일" → "아이디" 레이블 변경

---

## 구현 완료 사항

### ✅ 데이터베이스
- username 필드 추가 (필수)
- email 필드 선택으로 변경
- phone 필드 필수로 변경
- categories, regions, timeSlots 필드 추가

### ✅ 인증 시스템
- email → username 기반 로그인으로 변경
- lib/auth.ts 업데이트

### ✅ API
- POST /api/auth/signup: username, phone 필수 검증 추가
- PATCH /api/users/[id]/profile: 프로필 업데이트 API 생성
- POST /api/centers: 센터 코드 형식 검증 추가

### ✅ UI
- 회원가입: username, phone 필수 UI 업데이트
- 로그인: "이메일" → "아이디" 레이블 변경
- 프로필 완성: 2차 정보 입력 페이지 생성

### ✅ 유틸리티
- lib/validators/center.ts: 센터 코드 검증 함수 생성

---

## 향후 개선 사항

1. **이메일 인증** (선택)
   - email 필드 입력 시 인증 메일 발송
   - 인증 완료 시 verified 플래그 설정

2. **프로필 완성률**
   - 2차 정보 입력률 추적
   - 대시보드에 완성률 표시

3. **데이터 활용**
   - categories, regions, timeSlots 기반 방송 매칭
   - 통계 및 분석 기능 추가

---

## 마이그레이션 이력

### 2026-04-09: 초기 스키마 확정
- 기존 데이터 없음 (8명 데모 데이터 삭제)
- username, email, phone, categories, regions, timeSlots 필드 추가
- 프로덕션 런칭 전 스키마 확정

**주의:** 향후 스키마 변경 시 마이그레이션 파일로만 관리 (--force-reset 절대 사용 금지)
