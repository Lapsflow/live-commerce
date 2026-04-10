# Multi-Warehouse Barcode System Setup Guide

다중 창고 바코드 통합 시스템 설정 가이드입니다.

## 📋 사전 준비사항

### 1. Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 (예: "live-commerce-warehouse")
3. **Google Sheets API** 활성화:
   - APIs & Services → Enable APIs and Services
   - "Google Sheets API" 검색 후 Enable

### 2. Service Account 생성

1. IAM & Admin → Service Accounts
2. "Create Service Account" 클릭
3. 이름: `warehouse-sync-service`
4. Role: **None** (spreadsheet level permissions will be granted)
5. Create Key → JSON 다운로드
6. JSON 파일을 안전한 곳에 보관

JSON 파일 예시:
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "warehouse-sync@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

### 3. Google Spreadsheet 준비

각 창고(6개)별로 Google Spreadsheet를 준비합니다.

**Spreadsheet 구조 (A-D 컬럼):**
```
| A (Barcode)    | B (Product Name) | C (Quantity) | D (Location) |
|----------------|------------------|--------------|--------------|
| 8801234567890  | 상품명1          | 100          | 1층          |
| 8801234567891  | 상품명2          | 50           | 2층          |
```

**Service Account 권한 부여:**
1. 각 Spreadsheet 열기
2. 우측 상단 "공유" 클릭
3. Service Account Email (예: `warehouse-sync@your-project.iam.gserviceaccount.com`) 추가
4. 권한: **뷰어** (Viewer)

## 🔧 설정 단계

### Step 1: 환경변수 설정

`.env` 파일에 Google API 정보 추가:

```env
# Google Sheets API Credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL="warehouse-sync@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n"
```

**주의사항:**
- `GOOGLE_PRIVATE_KEY`는 JSON 파일의 `private_key` 값을 그대로 복사
- `\n`은 실제 줄바꿈으로 변환하지 말고 그대로 유지

### Step 2: 의존성 설치

```bash
npm install
```

새로 추가된 `googleapis` 패키지가 설치됩니다.

### Step 3: Database Migration 실행

```bash
npx prisma migrate dev --name add_multi_warehouse_support
```

4개의 새로운 테이블이 생성됩니다:
- `Warehouse` - 창고 마스터
- `BarcodeMaster` - 공식 바코드 원본
- `WarehouseInventory` - 창고별 재고
- `StockMovement` - 재고 이동 로그

### Step 4: 창고 데이터 시딩

```bash
npx tsx prisma/seed-warehouses.ts
```

6개의 창고가 생성됩니다:
- 한국무진 (KOREA_MUJIN)
- 쓰리백 (THREEBACK)
- 거래처2-5 (PARTNER_02 ~ PARTNER_05)

### Step 5: Spreadsheet ID 설정

각 창고의 Google Spreadsheet ID를 데이터베이스에 등록합니다.

**Spreadsheet ID 확인:**
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
                                         ^^^^^^^^^^^^^^^^
```

**Database 직접 업데이트:**
```bash
npx prisma studio
```

Prisma Studio에서:
1. `Warehouse` 테이블 열기
2. 각 창고별로 다음 필드 입력:
   - `spreadsheetId`: Spreadsheet ID
   - `sheetName`: 시트 이름 (기본값: "Sheet1")
   - `syncEnabled`: true

**또는 SQL로 직접 업데이트:**
```sql
UPDATE "Warehouse"
SET
  "spreadsheetId" = 'YOUR_SPREADSHEET_ID_HERE',
  "sheetName" = 'Sheet1'
WHERE code = 'KOREA_MUJIN';

-- 나머지 5개 창고도 동일하게 업데이트
```

### Step 6: 초기 동기화 테스트

로컬에서 수동으로 동기화를 실행하여 테스트합니다:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/warehouse-sync
```

**성공 응답 예시:**
```json
{
  "success": true,
  "message": "Warehouse sync completed",
  "timestamp": "2026-04-10T09:00:00.000Z",
  "summary": {
    "total": 6,
    "success": 6,
    "failed": 0,
    "recordsProcessed": 250
  },
  "results": [
    {
      "warehouse": "한국무진",
      "success": true,
      "records": 50
    },
    ...
  ]
}
```

### Step 7: Vercel 배포 및 Cron 설정

1. 환경변수 설정 (Vercel Dashboard):
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_PRIVATE_KEY=...
   CRON_SECRET=...
   ```

2. 배포:
   ```bash
   git add .
   git commit -m "Add multi-warehouse barcode system"
   git push
   ```

3. Vercel Cron이 자동으로 설정됩니다:
   - Path: `/api/cron/warehouse-sync`
   - Schedule: `0 0 * * *` (매일 00:00 UTC = 09:00 KST)

## ✅ 검증

### 1. Database Schema 확인

```bash
npx prisma studio
```

다음 테이블들이 존재하는지 확인:
- Warehouse (6개 레코드)
- BarcodeMaster
- WarehouseInventory
- StockMovement

### 2. 바코드 검색 테스트

1. 브라우저에서 `/barcode` 접속
2. Spreadsheet에 있는 바코드 입력 (예: 8801234567890)
3. 다음 정보가 표시되는지 확인:
   - 상품명, 판매가, 공급가
   - 총 재고 (모든 창고 합계)
   - 창고별 재고 테이블

### 3. 바코드 마스터 관리 테스트

1. MASTER 권한으로 로그인
2. `/admin/barcode-master` 접속
3. 새 바코드 등록 테스트
4. 등록된 바코드 목록 확인

### 4. 동기화 Cron 테스트

Vercel 배포 후:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://live-commerce-opal.vercel.app/api/cron/warehouse-sync
```

## 🔍 트러블슈팅

### Google Sheets API 403 Forbidden

**원인:** Service Account에 Spreadsheet 접근 권한 없음

**해결:**
1. Spreadsheet 공유 설정 확인
2. Service Account Email이 뷰어 권한으로 추가되었는지 확인

### No inventory found for product

**원인:** Spreadsheet의 바코드와 Product 테이블의 바코드가 일치하지 않음

**해결:**
1. 바코드 정규화 확인 (공백, 특수문자 제거)
2. Spreadsheet의 바코드 형식 확인 (A열이 바코드인지 확인)
3. `getOrCreateProduct()` 함수가 자동으로 상품을 생성하므로 재동기화

### Cron job not running

**원인:** Vercel Cron Secret 불일치

**해결:**
1. Vercel Dashboard → Settings → Environment Variables
2. `CRON_SECRET` 값 확인
3. Authorization 헤더에 올바른 값 사용

## 📊 운영

### 일일 동기화 모니터링

Vercel Dashboard → Logs에서 Cron 실행 로그 확인:
```
[Warehouse Sync] Starting daily sync...
[Warehouse Sync] Completed in 3456ms
[Warehouse Sync] Success: 6, Failed: 0
[Warehouse Sync] Total records: 250
```

### 수동 동기화 실행

필요시 GitHub Actions 또는 Vercel CLI로 수동 실행:
```bash
vercel env pull
curl -H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d '=' -f2)" \
     https://live-commerce-opal.vercel.app/api/cron/warehouse-sync
```

### Spreadsheet 업데이트 주기

- **일일 업데이트:** 각 창고에서 매일 오전 재고 데이터를 Spreadsheet에 업로드
- **자동 동기화:** 매일 09:00 KST에 자동으로 동기화 실행
- **실시간 조회:** 바코드 검색 시 최신 동기화 시간 표시

## 🚀 다음 단계

1. **실시간 동기화:** Webhook 기반 실시간 업데이트 구현
2. **재고 이동:** 창고 간 재고 이동 기능 추가
3. **입출고 처리:** 바코드 스캔으로 입출고 처리
4. **재고 실사:** 바코드 스캔으로 재고 조사 기능
5. **바코드 라벨 생성:** 상품 바코드 라벨 출력 기능

## 📞 지원

문제 발생 시:
1. Logs 확인 (Vercel Dashboard → Logs)
2. Database 상태 확인 (`npx prisma studio`)
3. Google Sheets API 권한 재확인
4. 개발팀에 문의
