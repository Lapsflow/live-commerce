# Google Apps Script 원본 코드

**원본 시스템**: Google Apps Script v2.5 라이브커머스 관리 시스템
**대상 시스템**: Next.js 16 + React 19 + Neon PostgreSQL

---

## 📁 파일

- **`original-code.gs`** - 전체 Apps Script 코드 (일체형)

---

## 📝 저장 방법

### 1. Apps Script 에디터 열기
```
Google Sheets → 확장 프로그램 → Apps Script
```

### 2. 전체 코드 복사
- Apps Script 에디터에서 **전체 선택** (Cmd+A)
- **복사** (Cmd+C)

### 3. 이 파일에 붙여넣기
```
/Users/jinwoo/Desktop/live-commerce/docs/appscript/original-code.gs
```
- 파일 열기 (VSCode 또는 텍스트 에디터)
- 기존 주석 삭제
- **붙여넣기** (Cmd+V)
- **저장** (Cmd+S)

### 4. 완료 알림
Claude에게 **"코드 저장 완료"** 라고 말씀해주세요.

---

## 🔍 자동 분석 예정 항목

저장 완료 후 자동으로 다음을 분석합니다:

1. **코드 구조 분석**
   - 전체 라인 수
   - 주요 함수 목록
   - doGet/doPost 엔드포인트

2. **기능 매핑**
   - Apps Script 기능 → Next.js 구현 매핑
   - 구현 완료/부분/누락 분류

3. **데이터 구조 분석**
   - Google Sheets 테이블 구조
   - Prisma 스키마와 비교

4. **갭 분석**
   - gap-detector 에이전트 실행
   - 누락 기능 우선순위 설정
   - 마이그레이션 로드맵 생성

5. **상세 리포트**
   - 기능별 완성도 (%)
   - 우선순위별 작업 목록
   - 예상 소요 시간

---

**분석 시작일**: 2026-04-06
**예상 분석 시간**: 2-3분
