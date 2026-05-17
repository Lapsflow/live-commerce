# ONEWMS API: get_trans_invoice (송장이미지)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=25bf9e2dd63680f889c2c3e8e889a8b6&pm=s)
> 마지막 편집: 2025-10-24

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `get_trans_invoice` |
| 타입 | 주문 |
| 설명 | ONEWMS 주문의 송장이미지를 조회 |

## 파라미터
| 파라미터 | 설명 | 필수 | 타입 | 기본값 |
|---|---|---|---|---|
| `trans_no` | 송장번호 | **O** | Integer | - |
| `template` | 양식번호 | X | Integer | API양식 |

## 응답
| 필드 | 설명 | 타입 |
|---|---|---|
| `error` | 0: 성공 | Integer |
| `msg` | 메시지 | String |
| `trans_corp` | 택배사 코드 | Integer |
| `trans_template` | 송장양식 코드 | Integer |
| `invoice_url` | 송장이미지 URL | String |
| `filename` | 송장이미지 파일명 | String |
| `total_quantity` | 송장이미지 장수 | Integer |
| `processed_count` | 처리된 주문수 | Integer |

## 응답 상세
| 내용 | error |
|---|---|
| 성공 | 0 |
| 송장번호 없음 | 1 |
| 요청한 양식이 존재하지 않음 | 1 |
| 택배사가 다른 송장번호 | 1 |
| 최근 한 달 내 출력 이력 없음 | 1 |

## 슈퍼무진 구현
`client.ts:243` — `getTransportInvoice(transNo: string)` (호출처 없음 — 미활용)
