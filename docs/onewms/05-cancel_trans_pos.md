# ONEWMS API: cancel_trans_pos (배송취소)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=26ff9e2dd636807b824be731fa77ea82&pm=s)
> 마지막 편집: 2025-09-15

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `cancel_trans_pos` |
| 타입 | 주문 |
| 설명 | 배송주문 취소처리 |

## 파라미터
| 파라미터 | 설명 | 필수 | 타입 | 기본값 |
|---|---|---|---|---|
| `trans_no` | 송장번호 | **O** | Integer | - |
| `worker` | 작업자 | X | String | ONEWMS API |

## 응답
| 필드 | 설명 | 타입 |
|---|---|---|
| `error` | 0: 성공 | Integer |
| `msg` | 메시지 | String |

## 응답 상세
| 내용 | error | msg |
|---|---|---|
| 성공 | 0 | success |
| 송장번호 없음 | 1 | Invalid trans_no |

## 슈퍼무진 구현
`client.ts:235` — `cancelTransportPos(data)` (호출처 없음 — 미활용)
