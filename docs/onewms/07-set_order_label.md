# ONEWMS API: set_order_label (주문태그)

> 출처: [Notion](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=330f9e2dd6368081849ddddb192c272a&pm=s)
> 마지막 편집: Mar 26 2026

## 기본
| 항목 | 값 |
|---|---|
| 함수명 | `set_order_label` |
| 타입 | 주문 |
| 설명 | 주문에 태그를 지정하거나 삭제 |

## 파라미터
| 파라미터 | 필수 | 타입 | 설명 |
|---|---|---|---|
| `seq` | O (택1) | string | 주문 관리번호 (콤마 구분 복수 가능, 최대 100개). 예: `1234,5678` |
| `label_name` | **O** | string | 태그명 (콤마 구분 복수 가능). 예: `긴급,VIP`. 미등록 태그는 자동 등록 |
| `mode` | X | string | `add`(기본) = 태그 지정, `delete` = 태그 삭제 |
| `check_pack` | X | int | `1` = 합포 주문 전체에 적용. 기본값 `0` (해당 주문만) |

## 응답
| 필드 | 타입 | 설명 |
|---|---|---|
| `error` | int | 0=성공, 1=실패 |
| `msg` | string | 결과 메시지 |
| `mode` | string | 실행된 모드 (add/delete) |
| `affected_count` | int | 추가/삭제된 태그 매핑 수 |
| `affected_orders` | array[int] | 처리된 주문 관리번호 배열 |

## 에러 케이스
| 조건 | msg |
|---|---|
| seq 없음 | 필수 파라미터를 입력해주세요. (seq) |
| label_name 없음 | label_name 파라미터를 입력해주세요. |
| seq + trans_no 동시 입력 | seq, trans_no 중 한 개만 입력해주세요. |
| seq 100개 초과 | seq는 최대 100개까지 입력 가능합니다. |
| trans_no 100개 초과 | trans_no는 최대 100개까지 입력 가능합니다. |
| 일치하는 주문 없음 | 파라미터와 일치하는 주문이 없습니다. |
| 잘못된 mode | mode는 add 또는 delete만 가능합니다. |

## 요청 예시
```
태그 지정: action=set_order_label&seq=1565744&label_name=긴급,VIP&mode=add
태그 삭제: action=set_order_label&seq=1565744&label_name=긴급&mode=delete
합포 전체 지정: action=set_order_label&seq=1565744&label_name=긴급&mode=add&check_pack=1
```

## 슈퍼무진 구현
`client.ts:255` — `setOrderLabel(data)` (호출처 없음 — 미활용)
