# Center Management API Documentation

Complete API reference for Center (센터) management system.

---

## Overview

The Center Management API provides endpoints for managing regional centers, their products, users, and statistics. All endpoints require authentication and follow role-based access control.

**Base URL**: `/api/centers`

**Authentication**: All endpoints require Bearer token in Authorization header

**Response Format**:
```typescript
// Success
{ data: { ... } }

// Error
{ error: { code: string, message: string } }
```

---

## Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/centers` | MASTER | List all centers |
| POST | `/api/centers` | MASTER | Create new center |
| GET | `/api/centers/[id]` | MASTER, SUB_MASTER, ADMIN | Get center details |
| PUT | `/api/centers/[id]` | MASTER | Update center |
| DELETE | `/api/centers/[id]` | MASTER | Soft delete center |
| GET | `/api/centers/[id]/users` | MASTER, SUB_MASTER, ADMIN | Get center users |
| GET | `/api/centers/[id]/products` | MASTER, SUB_MASTER, ADMIN, SELLER | Get center products |
| GET | `/api/centers/[id]/stats` | MASTER, ADMIN | Get center statistics |
| POST | `/api/centers/validate-code` | MASTER | Validate center code |
| GET | `/api/centers/check-available` | MASTER, SUB_MASTER, ADMIN | Check code availability |

---

## 1. List All Centers

List all centers with optional statistics.

**Endpoint**: `GET /api/centers`

**Auth**: MASTER only

**Query Parameters**: None

**Response**:
```typescript
{
  data: {
    center: Center[];
  }
}

interface Center {
  id: string;
  code: string;                    // "01-4213" format
  name: string;
  regionCode: string;               // "01" ~ "17"
  regionName: string;               // "서울특별시", "경기도", etc.
  representative: string;
  representativePhone: string;
  address: string;
  addressDetail: string | null;
  businessNo: string | null;
  contractDate: Date | null;
  contractDocument: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: {
    users: number;
    centerStocks: number;
    orders: number;
    broadcasts: number;
  }
}
```

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/centers" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "cm8kx...",
      "code": "01-0001",
      "name": "서울센터",
      "regionCode": "01",
      "regionName": "서울특별시",
      "representative": "홍길동",
      "representativePhone": "010-1234-5678",
      "address": "서울특별시 강남구 테헤란로 123",
      "addressDetail": "4층",
      "businessNo": "123-45-67890",
      "contractDate": "2026-01-01T00:00:00.000Z",
      "contractDocument": null,
      "isActive": true,
      "createdAt": "2026-04-01T00:00:00.000Z",
      "_count": {
        "users": 15,
        "centerStocks": 230,
        "orders": 1250,
        "broadcasts": 45
      }
    }
  ]
}
```

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Not MASTER role

---

## 2. Create New Center

Create a new center with validated center code.

**Endpoint**: `POST /api/centers`

**Auth**: MASTER only

**Request Body**:
```typescript
{
  code: string;                     // Format: "01-4213" (regionCode-phoneCode)
  name: string;
  regionCode: string;               // "01" ~ "17"
  regionName: string;
  representative: string;
  representativePhone: string;
  address: string;
  addressDetail?: string;
  businessNo?: string;
  contractDate?: string;            // ISO 8601 date string
  contractDocument?: string;
}
```

**Response**:
```typescript
{
  data: Center
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/centers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "01-4213",
    "name": "서울강남센터",
    "regionCode": "01",
    "regionName": "서울특별시",
    "representative": "김철수",
    "representativePhone": "010-9876-5432",
    "address": "서울특별시 강남구 역삼동 123",
    "addressDetail": "2층",
    "businessNo": "987-65-43210"
  }'
```

**Example Response**:
```json
{
  "data": {
    "id": "cm8ky...",
    "code": "01-4213",
    "name": "서울강남센터",
    "regionCode": "01",
    "regionName": "서울특별시",
    "representative": "김철수",
    "representativePhone": "010-9876-5432",
    "address": "서울특별시 강남구 역삼동 123",
    "addressDetail": "2층",
    "businessNo": "987-65-43210",
    "contractDate": null,
    "contractDocument": null,
    "isActive": true,
    "createdAt": "2026-04-13T07:30:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid center code format or duplicate code
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Not MASTER role

**Center Code Format**:
- Pattern: `/^\d{2}-\d{4}$/`
- Example: "01-4213"
- Region code (2 digits) + Phone code (4 digits)

---

## 3. Get Center Details

Get detailed information about a specific center.

**Endpoint**: `GET /api/centers/[id]`

**Auth**: MASTER, SUB_MASTER, ADMIN

**Path Parameters**:
- `id` (string): Center ID

**Response**:
```typescript
{
  data: CenterWithStats
}
```

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/centers/cm8kx..." \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**: Same as Create response with `_count` statistics

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Center not found

---

## 4. Update Center

Update center information.

**Endpoint**: `PUT /api/centers/[id]`

**Auth**: MASTER only

**Path Parameters**:
- `id` (string): Center ID

**Request Body**:
```typescript
{
  name?: string;
  representative?: string;
  representativePhone?: string;
  address?: string;
  addressDetail?: string;
  businessNo?: string;
  contractDate?: string;
  contractDocument?: string;
  isActive?: boolean;
}
```

**Response**:
```typescript
{
  data: Center
}
```

**Example Request**:
```bash
curl -X PUT "http://localhost:3000/api/centers/cm8kx..." \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "서울강남센터 (변경)",
    "representative": "김영희"
  }'
```

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Not MASTER role
- `404 Not Found`: Center not found

---

## 5. Soft Delete Center

Deactivate a center (soft delete, sets `isActive = false`).

**Endpoint**: `DELETE /api/centers/[id]`

**Auth**: MASTER only

**Path Parameters**:
- `id` (string): Center ID

**Response**:
```typescript
{
  data: Center  // with isActive = false
}
```

**Example Request**:
```bash
curl -X DELETE "http://localhost:3000/api/centers/cm8kx..." \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": {
    "id": "cm8kx...",
    "code": "01-4213",
    "name": "서울강남센터",
    "isActive": false,
    ...
  }
}
```

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Not MASTER role
- `404 Not Found`: Center not found

**Note**: This is a soft delete. The center data is preserved but marked as inactive.

---

## 6. Get Center Users

Get all users belonging to a specific center.

**Endpoint**: `GET /api/centers/[id]/users`

**Auth**: MASTER, SUB_MASTER, ADMIN

**Path Parameters**:
- `id` (string): Center ID

**Query Parameters**:
- `role` (optional): Filter by user role (MASTER, SUB_MASTER, ADMIN, SELLER)

**Response**:
```typescript
{
  data: {
    center: {
      id: string;
      code: string;
      name: string;
    };
    users: User[];
    count: number;
  }
}

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  channels: string[];
  avgSales: number | null;
  createdAt: Date;
}
```

**Example Request**:
```bash
# All users
curl -X GET "http://localhost:3000/api/centers/cm8kx.../users" \
  -H "Authorization: Bearer $TOKEN"

# Filter by role
curl -X GET "http://localhost:3000/api/centers/cm8kx.../users?role=ADMIN" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": {
    "center": {
      "id": "cm8kx...",
      "code": "01-0001",
      "name": "서울센터"
    },
    "users": [
      {
        "id": "cm8ky...",
        "email": "admin@seoul.com",
        "name": "김관리자",
        "phone": "010-1111-2222",
        "role": "ADMIN",
        "channels": ["네이버", "쿠팡"],
        "avgSales": 15000000,
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Center not found

---

## 7. Get Center Products

Get all products with stock in a specific center.

**Endpoint**: `GET /api/centers/[id]/products`

**Auth**: MASTER, SUB_MASTER, ADMIN, SELLER

**Path Parameters**:
- `id` (string): Center ID

**Query Parameters**:
- `minStock` (optional): Filter by minimum stock quantity
- `search` (optional): Search by product name, code, or barcode

**Response**:
```typescript
{
  data: {
    center: {
      id: string;
      code: string;
      name: string;
    };
    products: Product[];
    count: number;
  }
}

interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  sellPrice: number;
  supplyPrice: number;
  totalStock: number;
  centerStock: number;        // Stock at this center
  location: string | null;    // Storage location in center
}
```

**Example Request**:
```bash
# All products
curl -X GET "http://localhost:3000/api/centers/cm8kx.../products" \
  -H "Authorization: Bearer $TOKEN"

# With minimum stock filter
curl -X GET "http://localhost:3000/api/centers/cm8kx.../products?minStock=10" \
  -H "Authorization: Bearer $TOKEN"

# With search
curl -X GET "http://localhost:3000/api/centers/cm8kx.../products?search=laptop" \
  -H "Authorization: Bearer $TOKEN"

# Combined filters
curl -X GET "http://localhost:3000/api/centers/cm8kx.../products?minStock=10&search=laptop" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": {
    "center": {
      "id": "cm8kx...",
      "code": "01-0001",
      "name": "서울센터"
    },
    "products": [
      {
        "id": "cm8kz...",
        "code": "LAPTOP-001",
        "name": "맥북 프로 14인치",
        "barcode": "8801234567890",
        "sellPrice": 2500000,
        "supplyPrice": 2300000,
        "totalStock": 50,
        "centerStock": 15,
        "location": "A-101"
      }
    ],
    "count": 1
  }
}
```

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Center not found

**Search Behavior**:
- Case-insensitive
- Searches in: product name, code, barcode
- Uses OR logic (matches any field)

---

## 8. Get Center Statistics

Get comprehensive statistics for a specific center.

**Endpoint**: `GET /api/centers/[id]/stats`

**Auth**: MASTER, ADMIN

**Path Parameters**:
- `id` (string): Center ID

**Response**:
```typescript
{
  data: {
    center: CenterWithStats;
    stats: {
      userCount: number;
      productCount: number;
      orderCount: number;
      broadcastCount: number;
      totalStockQuantity: number;
      totalRevenue: number;
      activeBroadcasts: number;
    }
  }
}
```

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/centers/cm8kx.../stats" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": {
    "center": {
      "id": "cm8kx...",
      "code": "01-0001",
      "name": "서울센터",
      "_count": {
        "users": 15,
        "centerStocks": 230,
        "orders": 1250,
        "broadcasts": 45
      }
    },
    "stats": {
      "userCount": 15,
      "productCount": 230,
      "orderCount": 1250,
      "broadcastCount": 45,
      "totalStockQuantity": 5420,
      "totalRevenue": 125000000,
      "activeBroadcasts": 3
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Center not found

**Statistics Explanation**:
- `totalStockQuantity`: Sum of all product stocks in this center
- `totalRevenue`: Total order amount for orders processed by this center (PAID only)
- `activeBroadcasts`: Number of currently LIVE broadcasts from this center

---

## 9. Validate Center Code

Validate center code format and check availability.

**Endpoint**: `POST /api/centers/validate-code`

**Auth**: MASTER only

**Request Body**:
```typescript
{
  code: string;  // Center code to validate (e.g., "01-4213")
}
```

**Response**:
```typescript
{
  data: {
    valid: boolean;
    available: boolean;
    message: string;
  }
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/centers/validate-code" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "code": "01-4213" }'
```

**Example Responses**:

**Valid and Available**:
```json
{
  "data": {
    "valid": true,
    "available": true,
    "message": "Center code is valid and available"
  }
}
```

**Valid but Already in Use**:
```json
{
  "data": {
    "valid": true,
    "available": false,
    "message": "Center code 01-4213 is already in use"
  }
}
```

**Invalid Format**:
```json
{
  "data": {
    "valid": false,
    "available": false,
    "message": "Invalid format. Expected: \"01-4213\" (2-digit region code + 4-digit phone code)"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing `code` field
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Not MASTER role

**Validation Rules**:
- Pattern: `/^\d{2}-\d{4}$/`
- Region code must be 2 digits ("01" ~ "17")
- Phone code must be 4 digits

---

## 10. Check Code Availability

Quick check if a center code is already in use.

**Endpoint**: `GET /api/centers/check-available`

**Auth**: MASTER, SUB_MASTER, ADMIN

**Query Parameters**:
- `code` (required): Center code to check (e.g., "01-4213")

**Response**:
```typescript
{
  data: {
    code: string;
    available: boolean;
    exists: boolean;
  }
}
```

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/centers/check-available?code=01-4213" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Responses**:

**Available**:
```json
{
  "data": {
    "code": "01-4213",
    "available": true,
    "exists": false
  }
}
```

**Already in Use**:
```json
{
  "data": {
    "code": "01-4213",
    "available": false,
    "exists": true
  }
}
```

**Error Responses**:
- `400 Bad Request`: Missing `code` query parameter
- `401 Unauthorized`: No authentication
- `403 Forbidden`: Insufficient permissions

**Note**: This endpoint does NOT validate the code format, only checks existence. Use `/validate-code` for format validation.

---

## Error Response Format

All error responses follow this format:

```typescript
{
  error: {
    code: string;      // Error code (e.g., "unauthorized", "not_found")
    message: string;   // Human-readable Korean error message
  }
}
```

**Common Error Codes**:
- `unauthorized`: No authentication token or invalid session
- `forbidden`: Authenticated but insufficient permissions
- `not_found`: Resource not found
- `bad_request`: Invalid request parameters or body
- `internal_error`: Internal server error

---

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **MASTER** | Full access to all endpoints |
| **SUB_MASTER** | Read access to centers, users, products |
| **ADMIN** | Read access to centers, users, products, stats |
| **SELLER** | Read access to center products only |

**Permission Matrix**:

| Endpoint | MASTER | SUB_MASTER | ADMIN | SELLER |
|----------|:------:|:----------:|:-----:|:------:|
| GET /centers | ✅ | ❌ | ❌ | ❌ |
| POST /centers | ✅ | ❌ | ❌ | ❌ |
| GET /centers/[id] | ✅ | ✅ | ✅ | ❌ |
| PUT /centers/[id] | ✅ | ❌ | ❌ | ❌ |
| DELETE /centers/[id] | ✅ | ❌ | ❌ | ❌ |
| GET /centers/[id]/users | ✅ | ✅ | ✅ | ❌ |
| GET /centers/[id]/products | ✅ | ✅ | ✅ | ✅ |
| GET /centers/[id]/stats | ✅ | ❌ | ✅ | ❌ |
| POST /centers/validate-code | ✅ | ❌ | ❌ | ❌ |
| GET /centers/check-available | ✅ | ✅ | ✅ | ❌ |

---

## Regional Codes

Valid regional codes for `regionCode` field:

| Code | Region Name |
|:----:|-------------|
| 01 | 서울특별시 |
| 02 | 부산광역시 |
| 03 | 대구광역시 |
| 04 | 인천광역시 |
| 05 | 광주광역시 |
| 06 | 대전광역시 |
| 07 | 울산광역시 |
| 08 | 세종특별자치시 |
| 09 | 경기도 |
| 10 | 강원도 |
| 11 | 충청북도 |
| 12 | 충청남도 |
| 13 | 전라북도 |
| 14 | 전라남도 |
| 15 | 경상북도 |
| 16 | 경상남도 |
| 17 | 제주특별자치도 |

---

## Testing Examples

### Manual Testing with cURL

**1. List all centers (MASTER)**:
```bash
export TOKEN="your-master-token"
curl -X GET "http://localhost:3000/api/centers" \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

**2. Create a new center (MASTER)**:
```bash
curl -X POST "http://localhost:3000/api/centers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "09-1234",
    "name": "경기성남센터",
    "regionCode": "09",
    "regionName": "경기도",
    "representative": "이영수",
    "representativePhone": "010-1111-2222",
    "address": "경기도 성남시 분당구 판교역로 123",
    "businessNo": "111-22-33444"
  }' | jq
```

**3. Get center users with role filter (ADMIN)**:
```bash
export CENTER_ID="your-center-id"
curl -X GET "http://localhost:3000/api/centers/$CENTER_ID/users?role=SELLER" \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

**4. Search center products (SELLER)**:
```bash
curl -X GET "http://localhost:3000/api/centers/$CENTER_ID/products?search=노트북&minStock=5" \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

**5. Validate center code (MASTER)**:
```bash
curl -X POST "http://localhost:3000/api/centers/validate-code" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "code": "09-5678" }' \
  | jq
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-13 | Initial documentation for all 10 endpoints |

---

## Related Documentation

- [Phase 1.1 Verification Report](/Users/jinwoo/Desktop/live-commerce/docs/verification/phase-1.1-verification-report.md)
- [Center Service Layer](/Users/jinwoo/Desktop/live-commerce/lib/services/center/centerService.ts)
- [Database Schema (Prisma)](/Users/jinwoo/Desktop/live-commerce/prisma/schema.prisma)

---

**Documentation Status**: ✅ Complete
**Last Updated**: 2026-04-13
**Maintainer**: Development Team
