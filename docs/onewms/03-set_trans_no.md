# ONEWMS API: set_trans_no (송장입력)

> 출처: [Notion 공식](https://jiansoft.notion.site/ONEWMS-FMS-API-63a2365265a34261b785ad5c58c72b4f?p=237f9e2dd636802f96e7e4478b553f2f&pm=s)
> 마지막 편집: 2025-09-16

## 기본 정보
| 항목 | 값 |
|---|---|
| 함수명 | `set_trans_no` |
| 타입 | 주문 |
| 설명 | ONEWMS 주문에 송장을 입력하는 API |

## 요청 파라미터
| 파라미터 | 설명 | 필수 | 데이터 타입 | 기본값 | 비고 |
|---|---|---|---|---|---|
| `seq` | 관리번호 | **O** | Integer | - | |
| `trans_corp` | 택배사코드 | **O** | Integer | - | 기타정보조회에서 조회 |
| `trans_no` | 송장번호 | **O** | Integer | - | |
| `trans_pos` | 배송처리 | X | Integer | 0 | 0: 송장입력 / 1: 배송처리 |
| `type` | 타입 | X | Integer | 0 | 0: 송장입력 / 1: 송장번호 변경 / 2: 추가송장발행 |

## 응답
| 필드 | 설명 | 데이터 타입 | 비고 |
|---|---|---|---|
| `error` | 에러 코드 | Integer | 0: 성공 |
| `msg` | 결과 메시지 | String | - |

## 응답 상세
| No | 내용 | error | msg |
|---|---|---|---|
| 1 | 성공 | 0 | success |
| 2 | 파라미터 송장번호가 없음 | 1 | Invalid trans_no |
| 3 | 파라미터 송장번호가 이미 등록됨 | 1 | trans_no already exists |
| 4 | 주문의 상태가 접수가 아님 | 1 | Invalid status |
| 5 | 유효하지 않은 택배사코드 | 1 | Invalid trans_corp |

## 슈퍼무진 구현
- `client.ts:219` — `setTransportNumber(data: SetTransportNumberRequest)`
- 호출처: `lib/services/onewms/deliverySync.ts`
- ⚠️ 우리 코드의 필드명 확인 필요 (seq / trans_corp / trans_no / trans_pos / type)
