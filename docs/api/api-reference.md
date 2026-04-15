# API Reference

> Live Commerce Platform REST API 전체 레퍼런스

**Base URL**: `https://live-commerce-opal.vercel.app/api`
**환경**: Production

---

## 📋 목차

1. [인증 (Authentication)](#인증-authentication)
2. [사용자 관리 (User Management)](#사용자-관리-user-management)
3. [상품 관리 (Product Management)](#상품-관리-product-management)
4. [발주 관리 (Order Management)](#발주-관리-order-management)
5. [센터 관리 (Center Management)](#센터-관리-center-management)
6. [방송 관리 (Broadcast Management)](#방송-관리-broadcast-management)
7. [ONEWMS 통합](#onewms-통합)
8. [시세 조회 (Marketplace Pricing)](#시세-조회-marketplace-pricing)
9. [AI 분석](#ai-분석)
10. [샘플 발주 (Sample Shopping)](#샘플-발주-sample-shopping)
11. [통계 (Stats)](#통계-stats)
12. [Cron Jobs](#cron-jobs)

---

## 🔐 인증 (Authentication)

### POST /api/auth/signup
회원가입

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123!",
  "name": "홍길동",
  "role": "SELLER"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "SELLER"
  }
}
```

---

### POST /api/auth/[...nextauth]
NextAuth 인증 (로그인, 로그아웃, 세션 관리)

**Endpoints**:
- `POST /api/auth/callback/credentials` - 로그인
- `GET /api/auth/session` - 세션 조회
- `POST /api/auth/signout` - 로그아웃

**Login Request**:
```json
{
  "email": "user@example.com",
  "password": "password123!"
}
```

**Session Response**:
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "SELLER",
    "centerId": "center_456"
  },
  "expires": "2026-04-15T00:00:00.000Z"
}
```

---

## 👤 사용자 관리 (User Management)

### GET /api/users
사용자 목록 조회

**Auth**: MASTER, SUB_MASTER, ADMIN

**Query Parameters**:
- `role`: 역할 필터 (MASTER, SUB_MASTER, ADMIN, SELLER)
- `centerId`: 센터 ID 필터
- `search`: 이름 또는 이메일 검색

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123",
        "email": "seller@example.com",
        "name": "셀러1",
        "role": "SELLER",
        "centerId": "center_456",
        "center": {
          "id": "center_456",
          "name": "서울센터"
        },
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### GET /api/users/[id]
사용자 상세 조회

**Auth**: 본인 또는 MASTER, ADMIN

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "seller@example.com",
    "name": "셀러1",
    "role": "SELLER",
    "centerId": "center_456",
    "center": {
      "id": "center_456",
      "code": "01-4213",
      "name": "서울센터"
    },
    "stats": {
      "totalOrders": 42,
      "totalRevenue": 5000000
    }
  }
}
```

---

### PUT /api/users/[id]
사용자 정보 수정

**Auth**: 본인 또는 MASTER

**Request**:
```json
{
  "name": "홍길동 수정",
  "role": "ADMIN",
  "centerId": "center_789"
}
```

---

## 📦 상품 관리 (Product Management)

### GET /api/products
상품 목록 조회

**Auth**: 인증된 사용자

**Query Parameters**:
- `search`: 상품명 또는 바코드 검색
- `category`: 카테고리 필터
- `minStock`: 최소 재고 필터
- `centerId`: 센터별 재고 조회

**Response**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_123",
        "code": "P001",
        "barcode": "8801234567890",
        "name": "상품명",
        "category": "식품",
        "sellPrice": 10000,
        "supplyPrice": 7000,
        "totalStock": 100,
        "centerStocks": [
          {
            "centerId": "center_456",
            "stock": 50,
            "center": { "name": "서울센터" }
          }
        ]
      }
    ],
    "count": 1
  }
}
```

---

### GET /api/products/[id]
상품 상세 조회

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "prod_123",
    "code": "P001",
    "barcode": "8801234567890",
    "name": "상품명",
    "category": "식품",
    "sellPrice": 10000,
    "supplyPrice": 7000,
    "marginRate": 30,
    "totalStock": 100,
    "centerStocks": [...],
    "warehouseInventory": [
      {
        "warehouse": { "name": "서울창고" },
        "stock": 50,
        "lastUpdated": "2026-04-14T00:00:00.000Z"
      }
    ]
  }
}
```

---

### GET /api/barcode/search
바코드 검색

**Query Parameters**:
- `barcode`: 바코드 번호 (required)

**Response**:
```json
{
  "success": true,
  "data": {
    "product": { /* 상품 상세 */ },
    "centerStocks": [...],
    "warehouseInventory": [...]
  }
}
```

---

## 📋 발주 관리 (Order Management)

### GET /api/orders
발주 목록 조회

**Auth**: 셀러는 본인 발주만, 관리자는 전체

**Query Parameters**:
- `sellerId`: 셀러 ID 필터
- `status`: 상태 필터 (PENDING, APPROVED, REJECTED)
- `paymentStatus`: 결제 상태 필터
- `startDate`: 시작일
- `endDate`: 종료일

**Response**:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order_123",
        "orderNo": "ORD-20260414-001",
        "seller": { "id": "user_123", "name": "셀러1" },
        "totalAmount": 100000,
        "paymentStatus": "UNPAID",
        "approvalStatus": "PENDING",
        "uploadedAt": "2026-04-14T00:00:00.000Z"
      }
    ],
    "count": 1,
    "totalAmount": 100000
  }
}
```

---

### POST /api/orders
발주 생성 (Excel 업로드)

**Request** (multipart/form-data):
- `file`: Excel 파일

**Response**:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order_123",
      "orderNo": "ORD-20260414-001",
      "itemsCount": 10,
      "totalAmount": 100000
    }
  }
}
```

---

### PUT /api/orders/[id]/status
발주 상태 변경 (승인/거절)

**Auth**: ADMIN, MASTER

**Request**:
```json
{
  "approvalStatus": "APPROVED",
  "rejectionReason": null
}
```

---

## 🏢 센터 관리 (Center Management)

### GET /api/centers
센터 목록 조회

**Auth**: MASTER, SUB_MASTER, ADMIN

**Query Parameters**:
- `regionCode`: 지역 코드 필터 (01~17)
- `isActive`: 활성 상태 필터
- `includeStats`: 통계 포함 여부

**Response**:
```json
{
  "success": true,
  "data": {
    "centers": [
      {
        "id": "center_456",
        "code": "01-4213",
        "name": "서울센터",
        "regionCode": "01",
        "regionName": "서울",
        "representative": "홍길동",
        "representativePhone": "010-1234-5678",
        "address": "서울시 강남구...",
        "isActive": true,
        "_count": {
          "users": 10,
          "products": 100,
          "broadcasts": 5
        }
      }
    ],
    "count": 1
  }
}
```

---

### POST /api/centers
센터 생성

**Auth**: MASTER only

**Request**:
```json
{
  "code": "01-4213",
  "name": "서울센터",
  "regionCode": "01",
  "regionName": "서울",
  "representative": "홍길동",
  "representativePhone": "010-1234-5678",
  "address": "서울시 강남구...",
  "addressDetail": "3층",
  "businessNo": "123-45-67890"
}
```

---

### POST /api/centers/validate-code
센터 코드 검증

**Auth**: MASTER

**Request**:
```json
{
  "code": "01-4213"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "available": false,
    "message": "이미 사용 중인 센터코드입니다",
    "center": {
      "id": "center_456",
      "name": "서울센터"
    }
  }
}
```

---

### GET /api/centers/[id]/products
센터 상품 목록

**Auth**: MASTER, SUB_MASTER, ADMIN

**Query Parameters**:
- `minStock`: 최소 재고 필터
- `search`: 상품명 검색

---

## 📺 방송 관리 (Broadcast Management)

### GET /api/broadcasts
방송 목록 조회

**Query Parameters**:
- `sellerId`: 셀러 ID 필터
- `status`: 상태 필터 (SCHEDULED, LIVE, ENDED, CANCELLED)
- `startDate`: 시작일
- `endDate`: 종료일

**Response**:
```json
{
  "success": true,
  "data": {
    "broadcasts": [
      {
        "id": "broadcast_123",
        "title": "신상품 특가 방송",
        "platform": "NAVER",
        "seller": { "id": "user_123", "name": "셀러1" },
        "center": { "id": "center_456", "name": "서울센터" },
        "status": "SCHEDULED",
        "scheduledAt": "2026-04-15T18:00:00.000Z",
        "estimatedRevenue": 1000000
      }
    ]
  }
}
```

---

### POST /api/broadcasts
방송 생성

**Request**:
```json
{
  "title": "신상품 특가 방송",
  "platform": "NAVER",
  "scheduledAt": "2026-04-15T18:00:00.000Z",
  "estimatedRevenue": 1000000,
  "notes": "준비사항..."
}
```

---

### POST /api/broadcasts/[id]/start
방송 시작 (센터 연결)

**Request**:
```json
{
  "centerId": "center_456"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "broadcast": {
      "id": "broadcast_123",
      "status": "LIVE",
      "centerId": "center_456",
      "startedAt": "2026-04-14T18:00:00.000Z"
    }
  }
}
```

---

## 🔗 ONEWMS 통합

### POST /api/onewms/orders/sync
발주 ONEWMS 동기화

**Auth**: ADMIN, MASTER

**Request**:
```json
{
  "orderId": "order_123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "onewmsTransNo": "WMS-20260414-001",
    "status": "SUCCESS",
    "itemsCount": 10
  }
}
```

---

### POST /api/onewms/stock/sync
재고 동기화

**Request**:
```json
{
  "productId": "prod_123"
}
```

---

### GET /api/onewms/stats
ONEWMS 통계

**Response**:
```json
{
  "success": true,
  "data": {
    "totalOrders": 100,
    "successOrders": 95,
    "failedOrders": 5,
    "lastSyncAt": "2026-04-14T18:00:00.000Z",
    "successRate": 95
  }
}
```

---

### GET /api/cron/stock-sync
재고 동기화 Cron (6시간마다)

**Auth**: Cron secret bearer token

---

### GET /api/cron/delivery-sync
배송 상태 동기화 Cron (10분마다)

---

### GET /api/cron/warehouse-sync
창고 재고 동기화 Cron (매일)

---

## 💰 시세 조회 (Marketplace Pricing)

### GET /api/pricing/compare
시장 가격 비교

**Query Parameters**:
- `barcode`: 바코드 (required)
- `name`: 상품명 (optional)
- `price`: 우리 가격 (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "ourPrice": 10000,
    "naver": {
      "minPrice": 9500,
      "maxPrice": 12000,
      "avgPrice": 10500
    },
    "coupang": {
      "minPrice": 9800,
      "maxPrice": 11500,
      "avgPrice": 10300
    },
    "marketAvgPrice": 10400,
    "competitiveness": "GOOD",
    "priceGap": -400,
    "priceGapPercent": "-3.8"
  }
}
```

---

### POST /api/pricing/search
시장 상품 검색

**Request**:
```json
{
  "query": "삼성 갤럭시",
  "platform": "naver"
}
```

---

## 🤖 AI 분석

### POST /api/ai/analyze
상품 AI 분석

**Request**:
```json
{
  "barcode": "8801234567890"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "competitiveness": {
      "score": 85,
      "position": "mid",
      "message": "시장 평균 대비 경쟁력 우수"
    },
    "marginHealth": {
      "isHealthy": true,
      "recommendation": "현재 마진율 30%로 적정 수준"
    },
    "actionItems": [
      "프로모션 고려하여 판매량 증대",
      "네이버 쇼핑 등록 검토"
    ],
    "broadcastScript": "여러분, 이 상품은..."
  }
}
```

---

## 🛒 샘플 발주 (Sample Shopping)

### GET /api/proposals/cart
샘플 장바구니 조회

**Auth**: 인증된 사용자

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cart_123",
        "productId": "prod_123",
        "quantity": 2,
        "samplePrice": 0,
        "product": {
          "id": "prod_123",
          "name": "샘플 상품",
          "barcode": "8801234567890",
          "sellPrice": 10000
        }
      }
    ],
    "summary": {
      "totalItems": 1,
      "totalQuantity": 2,
      "totalAmount": 0
    }
  }
}
```

---

### POST /api/proposals/cart
장바구니에 추가

**Request**:
```json
{
  "productId": "prod_123",
  "quantity": 2,
  "samplePrice": 0
}
```

---

### DELETE /api/proposals/cart?productId=prod_123
장바구니에서 제거

---

### POST /api/proposals/cart/checkout
샘플 요청 (Checkout)

**Response**:
```json
{
  "success": true,
  "data": {
    "proposals": [
      {
        "id": "proposal_123",
        "productName": "샘플 상품",
        "status": "PENDING",
        "submittedBy": "user_123"
      }
    ]
  }
}
```

---

## 📊 통계 (Stats)

### GET /api/stats/dashboard
대시보드 통계

**Auth**: MASTER, ADMIN

**Response**:
```json
{
  "success": true,
  "data": {
    "totalOrders": 100,
    "totalRevenue": 10000000,
    "pendingOrders": 15,
    "approvedOrders": 80,
    "topSellers": [
      { "id": "user_123", "name": "셀러1", "revenue": 5000000 }
    ],
    "recentBroadcasts": [...],
    "lowStockProducts": [...]
  }
}
```

---

### GET /api/stats/seller/[id]
셀러별 통계

**Auth**: 본인 또는 ADMIN

---

### GET /api/stats/admin/[id]
관리자별 통계

**Auth**: MASTER

---

## 📝 Rate Limiting

모든 API는 다음 Rate Limit이 적용됩니다:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | 5 | 5분 |
| `/api/*` (일반) | 100 | 1분 |
| `/api/proposals/cart` | 20 | 1분 |
| `/api/ai/analyze` | 10 | 1시간 |
| `/api/pricing/*` | 30 | 1시간 |

**Rate Limit 초과 시**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "retryAfter": 300,
    "retryAt": "2026-04-14T18:05:00.000Z"
  }
}
```

**Response Headers**:
- `Retry-After`: 재시도까지 대기 시간 (초)
- `X-RateLimit-Reset`: 제한 해제 시각 (ISO 8601)

---

## 🔐 인증 헤더

모든 인증이 필요한 엔드포인트는 다음 헤더가 필요합니다:

```http
Cookie: authjs.session-token=<session-token>
```

NextAuth v5 사용으로 JWT 토큰이 암호화된 쿠키에 저장됩니다.

---

## 📚 에러 코드

| Code | HTTP Status | 의미 |
|------|-------------|------|
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `BAD_REQUEST` | 400 | 잘못된 요청 |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit 초과 |
| `INTERNAL_ERROR` | 500 | 서버 에러 |

**에러 응답 형식**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "로그인이 필요합니다"
  }
}
```

---

**Last Updated**: 2026-04-14
**API Version**: 1.0.0
