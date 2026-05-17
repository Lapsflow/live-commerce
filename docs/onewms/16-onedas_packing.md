# ONEWMS API: 원다스 (get_onedas_packing_no / get_onedas_packing_no_detail)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=2a4f9e2dd6368041a442c8c47f5deebc&pm=s)
> 마지막 편집: Nov 17 2025

## 개요
원다스(ONEDAS)는 ONEWMS 의 패킹·피킹 작업 단위. 작업일자별 / 피킹차수(no) / 패킹차수(no_sub) 로 구분.

---

## 1. get_onedas_packing_no (패킹차수 목록 조회)

전일/당일 등 특정 작업일자의 피킹차수 및 패킹차수 요약을 조회.

### 파라미터
| 파라미터 | 설명 | 필수 | 타입 | 형식 |
|---|---|---|---|---|
| `work_date` | 작업일자 | **O** | String | YYYY-MM-DD |

### 응답
| 필드 | 설명 | 타입 |
|---|---|---|
| `error` | 0=성공 | Integer |
| `msg` | 메시지 | String |
| `picking_orders` | 피킹차수 목록 | Array |

### picking_orders 항목
work_date, no(피킹차수), crdate, no_sub(총 패킹차수), cnt(총 송장수), picking_unit(작업인원), status, packing_orders(Array)

### packing_orders 항목
work_date, no, no_sub, crdate, cnt, picking_unit, status

### 성공 예시
```json
{
  "error": 0,
  "msg": "success",
  "picking_orders": [{
    "work_date": "2025-11-05",
    "no": 3,
    "crdate": "2025-11-05 10:12:45",
    "no_sub": 5,
    "cnt": 248,
    "picking_unit": 7,
    "status": 1,
    "packing_orders": [
      { "work_date": "2025-11-05", "no": 3, "no_sub": 1, "crdate": "...", "cnt": 50, "picking_unit": 2, "status": 1 },
      { "work_date": "2025-11-05", "no": 3, "no_sub": 2, "crdate": "...", "cnt": 60, "picking_unit": 2, "status": 1 }
    ]
  }]
}
```

### 오류
| 상황 | error | msg |
|---|---|---|
| work_date 미입력 | 1 | `work_date 필수` |
| 형식 오류 | 1 | `work_date 형식 오류 (YYYY-MM-DD)` |

---

## 2. get_onedas_packing_no_detail (패킹차수 상세 다운로드)

여러 개의 (작업일자, 피킹차수, 패킹차수) 조합을 입력하면 품목/로케이션/유통기한 기준의 상세 피킹/패킹 데이터를 반환.

### 요청
```bash
curl -X POST "http://api.onewms.co.kr/api.php?action=get_onedas_packing_no_detail&mode=1" \
  -H "Content-Type: application/json" \
  -d '{
    "picking_list": [
      { "work_date": "2025-11-05", "no": 3, "no_sub": 1 },
      { "work_date": "2025-11-05", "no": 3, "no_sub": 2 }
    ]
  }'
```

### 요청 본문 (JSON)
| 필드 | 설명 | 필수 | 타입 |
|---|---|---|---|
| `picking_list` | 조회 대상 목록 | **O** | Array (1개 이상) |

#### picking_list 요소
| 필드 | 설명 | 필수 | 타입 | 형식 |
|---|---|---|---|---|
| `work_date` | 작업일자 | **O** | String | YYYY-MM-DD |
| `no` | 피킹차수 | **O** | Integer | |
| `no_sub` | 패킹차수 | **O** | Integer | |

### 응답 data 항목
multi_location, location, expire_date, lot_no, ma_date, product_id, name, options, no_sub, no_sub_qty, qty, total_qty, order_id, trans_no, p_barcode

### 성공 예시
```json
{
  "error": 0,
  "msg": "success",
  "data": [{
    "multi_location": "A동-상온-01존",
    "location": "A-01-01",
    "expire_date": "2026-03-31",
    "lot_no": "LOT20250301",
    "ma_date": "2025-03-01",
    "product_id": "S000123",
    "name": "프리미엄 세제",
    "options": "1.2L",
    "no_sub": 1,
    "no_sub_qty": 10,
    "qty": 10,
    "total_qty": 50
  }]
}
```

### 오류
| 상황 | error | msg |
|---|---|---|
| picking_list 미입력 | 1 | `picking_list 필수` |
| work_date 형식 오류 | 1 | `[{idx}] work_date 형식 오류 (YYYY-MM-DD)` |
| no/no_sub 숫자 아님 | 1 | `[{idx}] no, no_sub 숫자 필수` |

---

## 슈퍼무진 구현
- `client.ts` — `getOnedasPackingNo(workDate)`, `getOnedasPackingNoDetail(pickingList)` (호출처 없음 — 미활용)

## 활용 시나리오
- 일일 패킹 작업 현황 대시보드 (작업 인원, 총 송장수, 상태)
- 송장-주문-상품-로케이션 통합 작업지시서 생성
