# ONEWMS API: set_trans_pos (배송처리)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=237f9e2dd63680148142dcedd5f32235&pm=s)
> 마지막 편집: 2025-07-21

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `set_trans_pos` |
| 타입 | 주문 |
| 설명 | ONEWMS 주문을 배송처리 |

## 파라미터
| 파라미터 | 설명 | 필수 | 타입 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `trans_no` | 송장번호 | **O** | Integer | - | |
| `check_hold` | 보류검사 | X | Integer | 0 | 0: 배송처리 / 1: 보류주문 배송불가 |
| `worker` | 작업자 | X | String | ONEWMS API | |

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
| 이미 배송됨 | 1 | already processed |
| 취소된 주문 | 1 | canceled order |
| 보류주문 | 1 | hold status |

## 슈퍼무진 구현
`client.ts:227` — `setTransportPos(data)`
