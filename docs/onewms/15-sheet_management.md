# ONEWMS API: 전표관리 (get_sheet_list / add_sheet / update_sheet / get_sheet_detail / add_sheet_items)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=1d2f9e2dd63680c1bc55fc90b755abb6&pm=s)
> 마지막 편집: Nov 6 2025

## 전표 타입
| sheet_type | 설명 |
|---|---|
| `STOCK_IN_SHEET` | 입고 전표 |
| `STOCK_OUT_SHEET` | 출고 전표 |
| `STOCK_ARRANGE_SHEET` | 조정 전표 |
| `STOCK_SHIFT_SHEET` | 이동 전표 |

## 전표 상태
| status | 의미 |
|---|---|
| 0 | 요청 |
| 1 | 작업중 |
| 2 | 완료 |
| 3 | 삭제 |

---

## 1. get_sheet_list (전표 조회)

### 파라미터
| 파라미터 | 필수 | 타입 | 비고 |
|---|---|---|---|
| `sheet_type` | **O** | String | 전표 타입 |
| `date_type` | **O** | Integer | 0=생성일, 1=작업일, 2=완료일 |
| `start_date` | **O** | String | YYYY-MM-DD |
| `end_date` | **O** | String | YYYY-MM-DD |
| `sheet_seq` | X | Integer | 특정 전표 조회 시 |
| `status` | X | Integer | 0~3 |
| `sub_domain_seq` | X | Integer | 화주 |

### 응답 data 항목
seq, title, status, status0/1/2_date, status0/1/2_worker, in_wh, in_wh_name, out_wh, out_wh_name, in_stock_type, out_stock_type, job_type, job_type_name, memo, supply_code, supply_name, sub_domain_seq, sub_domain_name

---

## 2. add_sheet (전표 생성)

### 파라미터
| 파라미터 | 필수 | 타입 | 기본값 | 비고 |
|---|---|---|---|---|
| `sheet_type` | **O** | String | - | 전표 타입 |
| `sheet_name` | X | String | "전표생성 API [날짜]" | |
| `warehouse_seq` | X | Integer | 1 | |
| `stock_type_seq` | X | Integer | 1 | |
| `job_type_seq` | X | Integer | 1 | |
| `supply_code` | X | Integer | 0 | |
| `partner_code` | X | Integer | 0 | |
| `sub_domain_seq` | X | Integer | 0 | |
| `warehouse_shift_seq` | X | Integer | - | STOCK_SHIFT_SHEET 전용 |
| `stock_type_shift_seq` | X | Integer | - | STOCK_SHIFT_SHEET 전용 |

### 응답
```json
{ "error": 0, "msg": "success", "data": 12345 }
```

---

## 3. update_sheet (전표 수정)

### 파라미터
| 파라미터 | 필수 | 타입 | 비고 |
|---|---|---|---|
| `sheet_type` | **O** | String | |
| `sheet_seq` | **O** | Integer | |
| `warehouse_seq` | X | Integer | |
| `stock_type` | X | Integer | |
| `job_type` | X | Integer | |
| `in_wh` / `in_stock_type` | X | Integer | |
| `out_wh` / `out_stock_type` | X | Integer | |
| `memo` / `supply_code` / `sub_domain_seq` | X | | |

---

## 4. get_sheet_detail (전표 상세 조회)

### 파라미터
| 파라미터 | 필수 | 타입 | 비고 |
|---|---|---|---|
| `type` | **O** | String | 전표 타입 |
| `sheet_seq` | **O** | Integer | |

### 응답
```json
{
  "errorcode": 0,
  "message": "...",
  "sheet_data": { ... },
  "detail_data": [ ... ],
  "dupdata": { ... }  // 중복 바코드 있을 때만
}
```

### detail_data 항목
seq, sheet_seq, product_id, barcode, name, options, status, status0/1/2_qty, status0/1/2_date, status0/1/2_worker, memo, period, in_period, out_period, supply_name

---

## 5. add_sheet_items (전표 상품추가)

### Query 파라미터
| 파라미터 | 필수 | 타입 | 비고 |
|---|---|---|---|
| `partner_key` / `domain_key` / `action=add_sheet_items` | **O** | | |
| `sheet_type` | **O** | String | |
| `sheet_seq` | **O** | Integer | |

### 요청 본문 (JSON, 멀티로케이션 미사용)
```json
[
  { "product_id": "S00001", "qty": 10 },
  { "product_id": "S00002", "qty": 5 }
]
```

### 요청 본문 (JSON, 멀티로케이션 사용 — add_sheet_items_period)
```json
[
  {
    "product_id": "S00001",
    "qty": 10,
    "memo": "유통기한 있는 상품",
    "expire_date": "2025-12-31",
    "lot_no": "LOT20231201"
  },
  {
    "product_id": "S00002",
    "qty": 5,
    "expire_date": "2026-06-30",
    "lot_no": "LOT20240101",
    "location": "A-01-01"
  }
]
```

### 응답
```json
{
  "error": 0,
  "msg": "success",
  "success_count": 2,
  "fail_count": 0,
  "success_list": [...],
  "fail_list": [],
  "inserted_items": [...]
}
```

---

## 슈퍼무진 구현
- `client.ts` — `getSheetList(params)`, `addSheet(data)` (호출처 없음 — 미활용)
- `update_sheet`, `get_sheet_detail`, `add_sheet_items` 는 client.ts 에 함수 없음 → 미구현

## 활용 시나리오
- 발주 → 출고 전표 자동 생성 (`add_sheet` + `add_sheet_items`)
- 재고 조정 시 전표 발행 (`STOCK_ARRANGE_SHEET`)
- 센터 간 이동 시 (`STOCK_SHIFT_SHEET`)
