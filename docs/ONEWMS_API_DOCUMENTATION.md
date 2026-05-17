# ONEWMS / ONEFMS API 명세서

> **출처**: [Notion 공식 문서](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f)
> **소유자**: 임찬영 (jiansoft)
> **태그**: 외부연동
> **생성일**: 2024-07-15
> **추출일**: 2026-05-13 (Firecrawl 자동 추출)

---

## 🔔 ONEWMS · ONEFMS API 이용 안내

ONEWMS / ONEFMS API는 안정적인 운영을 위해 전체 호출량을 지속적으로 모니터링하고 있습니다.

> ⚠️ **과도한 호출이 감지될 경우 사전 고지 없이 호출 제한이 적용될 수 있습니다.**
> 비정상적 또는 과도한 요청은 서버 부하를 유발하여 ONEWMS 서비스에 영향을 줄 수 있습니다.

### ✅ 권장사항

- API는 **필요한 범위 내에서 적정량**으로 호출해 주세요.
- 시스템 안정성을 위해 **반복적인 대량 호출은 자제**해 주시기 바랍니다.

> **🚨 슈퍼무진 적용 관점**:
> 현재 우리는 **1분 cron + batch API** 적용 중. 1,349개 상품을 1분마다 sync = 시간당 약 60회 호출.
> ONEWMS 측에서 "과도한 호출" 알람이 오면 cron 간격을 5분으로 늘려야 할 수 있음.

---

## 🌐 기본 정보

| 항목 | 값 |
|---|---|
| **호출 URL** | `https://api.onewms.co.kr/api.php` |
| **HTTP Method** | GET / POST |
| **응답 포맷** | JSON |

### 필수 파라미터

| Parameter | 항목 | 설명 |
|---|---|---|
| `partner_key` | 파트너키 | 파트너로 발급된 암호화된 키 (onesys.api_domain_list) |
| `domain_key` | 도메인키 | 고객사로 발급된 암호화된 키 (onesys.api_domain_list) |
| `action` | API 목록 | api 목록 내 함수명 |

> **슈퍼무진 환경변수 매핑**:
> - `ONEWMS_PARTNER_KEY` → `partner_key`
> - `ONEWMS_DOMAIN_KEY` → `domain_key`
> - `ONEWMS_API_URL` (선택, 기본값: `https://api.onewms.co.kr/api.php`)

---

## 📋 API 전체 목록

| 타입 | 이름 | 함수명 (action) | 설명 |
|---|---|---|---|
| **주문** | 주문조회 | `get_order_info` | 주문정보를 조회 |
| 주문 | 주문생성 | `set_orders` | 주문정보를 생성 |
| 주문 | 송장입력 | `set_trans_no` | 송장정보를 입력 |
| 주문 | 배송처리 | `set_trans_pos` | 주문 배송처리 |
| 주문 | 배송취소 | `cancel_trans_pos` | 배송주문 취소처리 |
| 주문 | 송장이미지 | `get_trans_invoice` | 송장이미지 조회 |
| 주문 | 주문태그 | `set_order_label` | 주문태그 지정 |
| **상품** | 상품조회 | `get_product_info` | 상품정보를 조회 |
| 상품 | 매칭정보조회 | `get_code_match` | 매칭정보를 조회 |
| 상품 | 상품추가 | `add_product` | 상품정보를 생성 |
| **기타** | 판매처/공급처/택배사/화주/재고타입/재고작업타입/카테고리 | `get_etc_info` | 기타정보를 조회 |
| **재고** | 재고조회 | `get_stock_info` | 현재고정보를 조회 |
| 재고 | 재고이력조회 | `get_stock_tx_info` | 재고변동량을 조회 |
| 재고 | 재고이력상세조회 | `get_stock_tx_detail_info` | 재고이력을 조회 |
| **전표** | 전표관리 | `get_sheet_list`, `add_sheet` ... | 전표 관리 |
| **원다스** | 원다스 | `get_onedas_packing_no`, `get_onedas_packing_no_detail` | 원다스 조회 |

---

## 📊 부록 — 상태 코드

### 에러 코드

| 코드 | 메시지 | 설명 |
|---|---|---|
| `0` | (정상) | 정상 처리 |

> 그 외 에러 코드는 공식 문서의 별도 페이지 참고 (현재 추출 미완)

### 주문 상태

| 값 | 항목 |
|---|---|
| `1` | 접수 |
| `7` | 송장 |
| `8` | 배송 |

### CS 상태

| 값 | 항목 |
|---|---|
| `0` | 정상 |
| `1` | 배송전 전체 취소 |
| `2` | 배송전 부분 취소 |
| `3` | 배송후 전체 취소 |
| `4` | 배송후 부분 취소 |
| `5` | 배송전 전체 교환 |
| `6` | 배송전 부분 교환 |
| `7` | 배송후 전체 교환 |
| `8` | 배송후 부분 교환 |

### 보류 상태

| 값 | 항목 |
|---|---|
| `0` | 정상 |
| `1` | 일반 |
| `2` | 주소변경 |
| `3` | 교환 |
| `4` | 전체취소 |
| `5` | 부분취소 |
| `6` | 합포변경 |

---

## 🔗 추가 상세 페이지 (별도 fetch 필요)

다음 페이지는 데이터베이스 view 라서 추가 fetch 필요:

- **필수 parameter 상세**: https://jiansoft.notion.site/de7eab2d996d4276ac8f021d7b56050c
- **API 목록 상세**: https://jiansoft.notion.site/22c26a6f1e90455da39a5a9e6b14667e

각 API의 입력 파라미터/응답 스키마는 위 데이터베이스에서 개별 페이지로 들어가야 확인 가능.

---

## 🎯 슈퍼무진 구현 매핑 (간략)

> 자세한 매핑표는 별도 문서 `ONEWMS_API_IMPLEMENTATION_MAP.md` 참조

| 공식 API (action) | 우리 구현 (client.ts) | 상태 |
|---|---|---|
| `get_order_info` | `getOrderInfo()` | ✅ |
| `set_orders` | `createOrder()` | ✅ |
| `set_trans_no` | `setTransportNumber()` | ✅ |
| `set_trans_pos` | `setTransportPos()` | ✅ |
| `cancel_trans_pos` | `cancelTransportPos()` | ✅ |
| `get_trans_invoice` | `getTransportInvoice()` | ✅ |
| `set_order_label` | `setOrderLabel()` | ✅ |
| `get_product_info` | `getProductList()` | ✅ |
| `get_code_match` | `getCodeMatch()` | ✅ |
| `add_product` | `addProduct()` | ✅ |
| `get_etc_info` | `getEtcInfo()`, `getStockJobTypes()` | ✅ |
| `get_stock_info` | `getStockInfo()` | ✅ |
| `get_stock_tx_info` | `getStockTxInfo()` | ✅ |
| `get_stock_tx_detail_info` | `getStockTxDetailInfo()` | ✅ |
| `get_sheet_list`, `add_sheet` | `getSheetList()`, `addSheet()` | ✅ |
| `get_onedas_packing_no` | `getOnedasPackingNo()` | ✅ |
| `get_onedas_packing_no_detail` | `getOnedasPackingNoDetail()` | ✅ |

→ **공식 API 19개 모두 구현 완료**

---

## 📝 참고 사항

- 공식 문서가 데이터베이스 형식이라 각 API 상세 페이지는 별도 추출 필요
- 응답 스키마, 필드 타입 등은 우리 코드의 `lib/onewms/types.ts` 와 함께 봐야 정확
- API 호출량 모니터링이 있으므로 운영 중 cron 빈도 조정 고려
