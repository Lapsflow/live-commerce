# Barcode Scanner UI - Plan Document

## 📌 Feature Overview

**Feature Name**: 바코드 스캔 UI (Barcode Scanner UI)
**Priority**: High
**Target Users**: 창고 관리자, 셀러, 재고 담당자
**Estimated Effort**: Medium (3-5 days)

---

## 🎯 Goals & Objectives

### Primary Goals
1. **재고 관리 효율화**: 수동 입력 대신 바코드 스캔으로 상품 식별 시간 단축
2. **입출고 프로세스 간소화**: 바코드 스캔 → 즉시 재고 업데이트
3. **모바일 최적화**: 태블릿/스마트폰 카메라로 현장에서 바로 사용
4. **오류 감소**: 수동 입력 실수 방지

### Success Metrics
- 상품 등록/조회 시간 **70% 단축**
- 재고 입력 오류율 **90% 감소**
- 모바일 디바이스 사용률 **50% 이상**

---

## 👥 User Stories

### US-1: 창고 관리자 - 입고 처리
> **As a** 창고 관리자
> **I want to** 입고된 상품 바코드를 스캔하여
> **So that** 재고를 빠르게 등록하고 수량을 업데이트할 수 있다

**Acceptance Criteria**:
- [ ] 바코드 스캔 시 상품 정보가 자동으로 표시됨
- [ ] 수량 입력 후 재고 즉시 반영
- [ ] 스캔 이력 로그 기록

### US-2: 셀러 - 상품 조회
> **As a** 셀러
> **I want to** 방송용 상품 바코드를 스캔하여
> **So that** 상품 상세 정보와 재고를 빠르게 확인할 수 있다

**Acceptance Criteria**:
- [ ] 스캔 후 즉시 상품 상세 페이지로 이동
- [ ] 센터별 재고 현황 표시
- [ ] 최근 스캔 이력 저장

### US-3: 재고 담당자 - 출고 처리
> **As a** 재고 담당자
> **I want to** 출고할 상품 바코드를 스캔하여
> **So that** 출고 처리를 빠르게 완료할 수 있다

**Acceptance Criteria**:
- [ ] 바코드 스캔 후 출고 수량 입력
- [ ] 재고 차감 즉시 반영
- [ ] 출고 완료 알림

---

## 🏗️ Technical Architecture

### High-Level Components

```
┌─────────────────────────────────────────┐
│  Barcode Scanner Page                   │
│  /inventory/barcode                     │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  BarcodeScannerComponent                │
│  - Camera stream                        │
│  - Barcode detection (quagga2)          │
│  - Manual input fallback                │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  API Layer                              │
│  - GET /api/products/barcode/[code]     │
│  - POST /api/inventory/scan             │
│  - GET /api/inventory/scan-history      │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Database (Prisma)                      │
│  - Product (barcode field)              │
│  - ProductCenterStock                   │
│  - ScanLog (new table)                  │
└─────────────────────────────────────────┘
```

### Technology Stack
- **Camera Access**: `react-webcam` or native MediaDevices API
- **Barcode Detection**: `quagga2` (supports multiple formats)
- **UI Framework**: Shadcn/ui components
- **State Management**: React hooks (useState, useRef)
- **Mobile Optimization**: Responsive CSS + touch events

---

## 📦 Database Schema

### New Table: ScanLog

```prisma
model ScanLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  productId   String?
  product     Product? @relation(fields: [productId], references: [id])
  barcode     String
  scanType    String   // "INBOUND" | "OUTBOUND" | "LOOKUP"
  quantity    Int?
  centerId    String?
  center      Center?  @relation(fields: [centerId], references: [id])
  scannedAt   DateTime @default(now())
  metadata    Json?    // Additional scan context

  @@index([userId, scannedAt])
  @@index([barcode])
  @@index([productId])
}
```

### Update Product Table

```prisma
model Product {
  // ... existing fields
  barcode     String?  @unique  // Add barcode field
  scanLogs    ScanLog[]
}
```

---

## 🔄 User Flow

### Flow 1: 재고 입고 스캔

```
1. User → Navigate to /inventory/barcode?mode=inbound
2. System → Request camera permission
3. User → Grant permission
4. System → Start camera stream
5. User → Point camera at barcode
6. System → Detect barcode (e.g., "8801234567890")
7. System → Fetch product info via API
8. System → Display product details + current stock
9. User → Enter inbound quantity (e.g., 100)
10. User → Click "입고 완료"
11. System → POST /api/inventory/scan
12. System → Update ProductCenterStock
13. System → Create ScanLog record
14. System → Show success toast
15. System → Ready for next scan
```

### Flow 2: 상품 조회 스캔

```
1. User → Navigate to /inventory/barcode?mode=lookup
2. System → Start camera
3. User → Scan barcode
4. System → Fetch product via /api/products/barcode/[code]
5. System → Display product details modal
   - Product name, image
   - Price, category
   - Center stock levels
   - Recent sales data
6. User → View details
7. User → Close modal or scan next
```

---

## 🎨 UI/UX Requirements

### Scanner Screen Layout

```
┌─────────────────────────────────────────┐
│  [←] 바코드 스캔               [⚙️ 설정] │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────┐         │
│     │                         │         │
│     │   📷 Camera Preview     │         │
│     │                         │         │
│     │   [Scan Frame Overlay]  │         │
│     │                         │         │
│     └─────────────────────────┘         │
│                                         │
│  💡 바코드를 스캔 영역에 맞춰주세요     │
│                                         │
├─────────────────────────────────────────┤
│  수동 입력: [____________] [검색]        │
├─────────────────────────────────────────┤
│  최근 스캔:                             │
│  • 상품A - 10분 전                      │
│  • 상품B - 25분 전                      │
└─────────────────────────────────────────┘
```

### Product Details Modal (After Scan)

```
┌─────────────────────────────────────────┐
│  ✅ 스캔 완료                     [✕]   │
├─────────────────────────────────────────┤
│  [Product Image]                        │
│                                         │
│  상품명: 테스트 상품 A                  │
│  바코드: 8801234567890                  │
│  카테고리: 식품 > 과자                  │
│  판매가: 5,000원                        │
│                                         │
│  ─────────────────────────────────────  │
│  📦 센터별 재고 현황                    │
│  • 01-4213 (서울): 150개               │
│  • 02-3245 (부산): 80개                │
│                                         │
│  ─────────────────────────────────────  │
│  [모드별 액션]                          │
│  • Inbound: [수량: __] [입고 완료]     │
│  • Outbound: [수량: __] [출고 완료]    │
│  • Lookup: [상품 상세 보기]            │
└─────────────────────────────────────────┘
```

---

## 🔧 API Endpoints

### 1. GET /api/products/barcode/[code]
**Purpose**: 바코드로 상품 조회

**Request**:
```
GET /api/products/barcode/8801234567890
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "prod_123",
    "name": "테스트 상품 A",
    "barcode": "8801234567890",
    "sellPrice": 5000,
    "category": "식품 > 과자",
    "imageUrl": "/uploads/products/...",
    "centerStocks": [
      { "centerId": "center_1", "centerName": "서울센터", "stock": 150 },
      { "centerId": "center_2", "centerName": "부산센터", "stock": 80 }
    ]
  }
}
```

### 2. POST /api/inventory/scan
**Purpose**: 스캔 이벤트 기록 및 재고 업데이트

**Request**:
```json
{
  "barcode": "8801234567890",
  "scanType": "INBOUND",
  "quantity": 100,
  "centerId": "center_1"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scanLogId": "log_456",
    "productId": "prod_123",
    "updatedStock": 250,
    "scannedAt": "2026-04-15T10:30:00Z"
  }
}
```

### 3. GET /api/inventory/scan-history
**Purpose**: 스캔 이력 조회

**Query Params**:
- `limit`: 20 (default)
- `userId`: current user
- `scanType`: INBOUND | OUTBOUND | LOOKUP

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "log_456",
      "barcode": "8801234567890",
      "productName": "테스트 상품 A",
      "scanType": "INBOUND",
      "quantity": 100,
      "scannedAt": "2026-04-15T10:30:00Z"
    }
  ]
}
```

---

## 📱 Mobile Optimization

### Responsive Breakpoints
- **Desktop**: Full screen scanner (1024px+)
- **Tablet**: Landscape camera (768px - 1023px)
- **Mobile**: Portrait camera (< 768px)

### Touch Gestures
- **Tap to focus**: Camera focus on tap point
- **Pinch to zoom**: Camera zoom control
- **Swipe up**: Manual input keyboard

### Performance
- Camera stream: 30 FPS
- Barcode detection: < 500ms latency
- Page load: < 2 seconds on 4G

---

## 🔒 Security & Permissions

### Camera Permission
- Request on first access
- Graceful fallback to manual input if denied
- Clear permission request messaging

### Access Control
- SELLER, ADMIN, MASTER roles can access scanner
- Center-specific stock updates require centerId validation
- Audit log for all scan events

---

## 🚀 Implementation Phases

### Phase 1: Core Scanner (2 days)
- [ ] Camera access component
- [ ] Barcode detection integration (quagga2)
- [ ] Basic UI layout
- [ ] Manual input fallback

### Phase 2: Product Integration (1 day)
- [ ] Product lookup API
- [ ] Product details modal
- [ ] Center stock display

### Phase 3: Inventory Actions (1 day)
- [ ] Inbound/Outbound mode
- [ ] Quantity input
- [ ] Stock update API
- [ ] ScanLog creation

### Phase 4: History & Polish (1 day)
- [ ] Scan history component
- [ ] Settings (camera selection, beep sound)
- [ ] Error handling
- [ ] Mobile optimization

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Camera permission denied | High | Provide clear manual input alternative |
| Barcode detection accuracy | Medium | Support multiple barcode formats, allow manual override |
| Mobile browser compatibility | High | Test on iOS Safari, Android Chrome, fallback to input |
| Network latency | Medium | Show loading state, cache recent products |
| Barcode field missing in Product | High | Migration script to add barcode field |

---

## 📊 Testing Strategy

### Unit Tests
- Barcode validation logic
- API endpoint handlers
- Stock update calculations

### Integration Tests
- Camera permission flow
- Barcode detection accuracy
- Product lookup API

### E2E Tests (Playwright)
- Full inbound scan workflow
- Full outbound scan workflow
- Manual input fallback
- Mobile responsive layout

---

## 📚 Dependencies

### New NPM Packages
```json
{
  "quagga2": "^1.8.0",        // Barcode detection
  "react-webcam": "^7.2.0"    // Camera access (optional)
}
```

### Browser APIs
- **MediaDevices.getUserMedia()**: Camera access
- **ImageCapture API**: Optional for better quality

---

## 🔗 Related Features

- **재고 관리**: 스캔 후 재고 자동 업데이트
- **ONEWMS 연동**: 스캔 데이터 → WMS 동기화
- **상품 등록**: 바코드 필드 추가 지원
- **방송 상품 선택**: 바코드 스캔으로 빠른 상품 추가

---

## ✅ Definition of Done

- [ ] 모든 User Stories의 Acceptance Criteria 충족
- [ ] API 엔드포인트 3개 구현 및 테스트 통과
- [ ] 모바일 Chrome/Safari 테스트 완료
- [ ] Database migration 적용 (ScanLog, Product.barcode)
- [ ] E2E 테스트 통과율 100%
- [ ] 코드 리뷰 승인
- [ ] 문서 업데이트 (README, API docs)

---

**Created**: 2026-04-15
**Author**: Development Team
**Status**: Draft → Ready for Design
