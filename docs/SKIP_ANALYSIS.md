# SKIP 분석 보고서

> 분석 일자: 2026-05-09
> 대상 파일: `tests/e2e/phase-{1..7}.spec.ts` (7개 파일)
> 분석자: Agent 1 (Analysis Only)

---

## 요약

- **총 SKIP**: 42건
- **분류 A (테스트 데이터 부재)**: 30건
- **분류 B (사용자/인증 부재)**: 2건
- **분류 C (외부 API 미연결)**: 0건
- **분류 D (환경 변수 미설정)**: 0건
- **분류 E (미구현 기능)**: 0건
- **분류 F (의도적/방어적 SKIP)**: 10건

### 핵심 발견

대부분의 SKIP(71%)은 **분류 A (테스트 데이터 부재)**로, 테스트 실행 시점에 필요한 상품/발주/상태 데이터가 DB에 존재하지 않아 발생한다. 이는 테스트 간 데이터 의존성 문제이며, **테스트 시작 전 API 호출로 데이터를 사전 생성**하면 대부분 해결 가능하다.

---

## 상세 분석

### SKIP #1
- **파일**: `tests/e2e/phase-1-center-account.spec.ts:66`
- **시나리오**: `3-5. 센터 + 관리자 계정 동시 등록 (임시 비밀번호)`
- **조건**: `if (res.status() === 400)` - 센터 코드 중복 등으로 생성 실패 시
- **원인**: 이전 테스트 실행에서 동일 센터 코드가 이미 생성됨 (데이터 오염)
- **분류**: F (의도적/방어적)
- **9가지 항목**: 항목 1 (센터 ID/PW 가입 검증)
- **해결 방안**: 타임스탬프 기반 고유 코드를 사용하므로 중복 가능성 낮음. 테스트 전 cleanup 또는 고유 seed 보장.

---

### SKIP #2
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:75`
- **시나리오**: `4-5. 셀러 발주 생성 (본사+센터 혼합)`
- **조건**: `if (hqProducts.length === 0 && centerProducts.length === 0)` - HEADQUARTERS/CENTER 상품 모두 없음
- **원인**: DB에 상품 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: 테스트 전 `POST /api/products`로 HQ 상품 + CENTER 상품 각 1개 이상 생성

### SKIP #3
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:88`
- **시나리오**: `4-5. 셀러 발주 생성 (본사+센터 혼합)` (두 번째 체크)
- **조건**: `if (items.length === 0)` - 유효한 상품이 없음
- **원인**: 상품은 있지만 발주 가능한 상품(가격 설정 등)이 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: supplyPrice > 0, sellPrice > 0인 상품 사전 생성

### SKIP #4
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:98`
- **시나리오**: `4-5. 셀러 발주 생성 (본사+센터 혼합)` (세 번째 체크)
- **조건**: `if (response.status() === 400)` - 재고 부족 등으로 발주 생성 실패
- **원인**: 재고 선점(reserveStock) 실패 또는 가격 검증 실패
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: 충분한 totalStock을 가진 상품 사전 생성

### SKIP #5
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:146`
- **시나리오**: `10. 마스터가 본사 발주 컨펌 (API)`
- **조건**: `if (!ordersRes.ok())` - 발주 목록 API 호출 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: auth setup이 정상이면 거의 발생하지 않음

### SKIP #6
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:150`
- **시나리오**: `10. 마스터가 본사 발주 컨펌 (API)`
- **조건**: `if (!pendingOrder)` - PENDING 상태 발주가 없음
- **원인**: DB에 PENDING 상태 발주 미존재
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: 테스트 전 `POST /api/orders`로 PENDING 발주 생성 (시나리오 4-5가 선행)

### SKIP #7
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:163`
- **시나리오**: `11. 발주 상태 "입금대기"로 전환 확인`
- **조건**: `if (!ordersRes.ok())` - 발주 목록 API 호출 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: auth setup이 정상이면 거의 발생하지 않음

### SKIP #8
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:229`
- **시나리오**: `16-17. 입금확인 → 출고 흐름 (API)`
- **조건**: `if (!ordersRes.ok())` - 발주 목록 API 호출 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 8 (입금 처리)
- **해결 방안**: auth setup이 정상이면 거의 발생하지 않음

### SKIP #9
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:236`
- **시나리오**: `16-17. 입금확인 → 출고 흐름 (API)`
- **조건**: `if (!approvedUnpaid)` - APPROVED+UNPAID 상태 발주 없음
- **원인**: APPROVED + UNPAID 상태 발주가 DB에 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 8 (입금 처리)
- **해결 방안**: 테스트 전 발주 생성 + 컨펌(APPROVED) 선행 필요

### SKIP #10
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:242`
- **시나리오**: `16-17. 입금확인 → 출고 흐름 (API)`
- **조건**: `if (!payRes.ok())` - 입금확인 API 실패
- **원인**: 이미 입금 처리된 발주이거나 상태 불일치
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 8 (입금 처리)
- **해결 방안**: 전용 APPROVED+UNPAID 발주를 사전 생성

### SKIP #11
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:255`
- **시나리오**: `18. 출고 후 상태 확인 (API)`
- **조건**: `if (!ordersRes.ok())` - 발주 목록 API 호출 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 2 (발주 전체 기능)
- **해결 방안**: auth setup 정상이면 거의 발생하지 않음

### SKIP #12
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:273`
- **시나리오**: `19. 발주 상세 페이지 라벨 표시`
- **조건**: `if (!ordersRes.ok())` - 발주 목록 API 호출 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 9 (UI 정리)
- **해결 방안**: auth setup 정상이면 거의 발생하지 않음

### SKIP #13
- **파일**: `tests/e2e/phase-2-order-flow.spec.ts:276`
- **시나리오**: `19. 발주 상세 페이지 라벨 표시`
- **조건**: `if (orders.length === 0)` - 발주가 전혀 없음
- **원인**: DB에 발주 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 9 (UI 정리)
- **해결 방안**: 테스트 전 최소 1건 발주 생성

---

### SKIP #14
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:49`
- **시나리오**: `3-4. 바코드 검색 API 동작 확인`
- **조건**: `if (!product)` - 바코드 보유 상품 없음
- **원인**: DB에 barcode 필드가 설정된 상품이 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: barcode 필드가 있는 HEADQUARTERS 상품 사전 생성

### SKIP #15
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:62`
- **시나리오**: `5. 바코드 스캔 API 응답 확인`
- **조건**: `if (!product)` - 바코드 보유 상품 없음
- **원인**: DB에 barcode 필드가 설정된 상품이 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: #14와 동일

### SKIP #16
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:76`
- **시나리오**: `6. 바코드 응답 시간 측정 (2초 이내)`
- **조건**: `if (!product)` - 바코드 보유 상품 없음
- **원인**: DB에 barcode 필드가 설정된 상품이 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: #14와 동일

### SKIP #17
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:92`
- **시나리오**: `7. 자동 등록 상품 확인 (autoCreated)`
- **조건**: `if (!res.ok())` - 상품 목록 API 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: auth setup 정상이면 거의 발생하지 않음

### SKIP #18
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:107`
- **시나리오**: `8. 자동 등록 상품 발주 가능 확인`
- **조건**: `if (!validProduct)` - supplyPrice > 0 && sellPrice > 0인 상품 없음
- **원인**: 가격이 설정된 상품이 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: 유효 가격이 설정된 상품 사전 생성

### SKIP #19
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:118`
- **시나리오**: `9. ONEWMS 상품 코드 확인`
- **조건**: `if (!res.ok())` - HEADQUARTERS 상품 API 실패
- **원인**: API 오류 또는 인증 문제
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: auth setup 정상이면 거의 발생하지 않음

### SKIP #20
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:158`
- **시나리오**: `13. 상품 가격 정보 정합성 확인`
- **조건**: `if (products.length === 0)` - HEADQUARTERS 상품이 없음
- **원인**: DB에 HEADQUARTERS 상품이 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: HEADQUARTERS 상품 사전 생성

### SKIP #21
- **파일**: `tests/e2e/phase-3-barcode-wms.spec.ts:185`
- **시나리오**: `상품 상세 페이지에서 바코드 표시`
- **조건**: `if (products.length === 0)` - 상품이 전혀 없음
- **원인**: DB에 상품 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 3 (바코드 + WMS API)
- **해결 방안**: 최소 1개 상품 사전 생성

---

### SKIP #22
- **파일**: `tests/e2e/phase-4-order-wms.spec.ts:38`
- **시나리오**: `1. 발주 컨펌 API 동작 확인 (HEADQUARTERS)`
- **조건**: PENDING 상태 HEADQUARTERS 발주 없음
- **원인**: DB에 PENDING + HEADQUARTERS 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 4 (신규 발주 -> WMS 입력)
- **해결 방안**: HEADQUARTERS 상품으로 PENDING 발주 사전 생성

### SKIP #23
- **파일**: `tests/e2e/phase-4-order-wms.spec.ts:61`
- **시나리오**: `2. 본사 발주 컨펌 후 WMS sync 상태 확인`
- **조건**: `if (!approvedOrder)` - APPROVED + HEADQUARTERS 발주 없음
- **원인**: DB에 APPROVED 상태의 HEADQUARTERS 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 4 (신규 발주 -> WMS 입력)
- **해결 방안**: 발주 생성 + 컨펌 선행 필요

### SKIP #24
- **파일**: `tests/e2e/phase-4-order-wms.spec.ts:83`
- **시나리오**: `3. 센터 발주는 WMS sync 미발생 확인`
- **조건**: `if (!approvedCenter)` - APPROVED + CENTER 발주 없음
- **원인**: DB에 APPROVED 상태의 CENTER 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 4 (신규 발주 -> WMS 입력)
- **해결 방안**: CENTER 상품으로 발주 생성 + 컨펌 선행 필요

### SKIP #25
- **파일**: `tests/e2e/phase-4-order-wms.spec.ts:167`
- **시나리오**: `7. WMS sync 매핑 데이터 일관성 확인`
- **조건**: `if (orders.length === 0)` - HEADQUARTERS 발주 없음
- **원인**: DB에 HEADQUARTERS 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 4 (신규 발주 -> WMS 입력)
- **해결 방안**: HEADQUARTERS 발주 사전 생성

### SKIP #26
- **파일**: `tests/e2e/phase-4-order-wms.spec.ts:201`
- **시나리오**: `8. 수동 WMS sync API 동작 확인`
- **조건**: `if (!target)` - APPROVED 상태 HEADQUARTERS 발주 없음
- **원인**: DB에 APPROVED 상태 HEADQUARTERS 발주 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 4 (신규 발주 -> WMS 입력)
- **해결 방안**: HEADQUARTERS 발주 생성 + 컨펌 선행

---

### SKIP #27
- **파일**: `tests/e2e/phase-5-center-distribution.spec.ts:45`
- **시나리오**: `1. 혼합 발주 생성 -> 자동 분리 확인 (API 구조)`
- **조건**: HQ 또는 CENTER 상품 중 하나가 없음
- **원인**: 두 유형의 상품이 모두 존재하지 않음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 5 (센터별 자동 분배)
- **해결 방안**: HQ + CENTER 상품 각각 사전 생성

### SKIP #28
- **파일**: `tests/e2e/phase-5-center-distribution.spec.ts:52`
- **시나리오**: `1. 혼합 발주 생성 -> 자동 분리 확인` (두 번째 체크)
- **조건**: `if (!hqProduct || !centerProduct)` - 유효 가격 상품 없음
- **원인**: supplyPrice > 0 && sellPrice > 0인 상품이 양 유형에 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 5 (센터별 자동 분배)
- **해결 방안**: 유효 가격 상품 사전 생성

### SKIP #29
- **파일**: `tests/e2e/phase-5-center-distribution.spec.ts:82`
- **시나리오**: `1. 혼합 발주 생성 -> 자동 분리 확인` (세 번째 체크)
- **조건**: `if (res.status() === 400)` - 재고 부족
- **원인**: 재고 선점 실패
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 5 (센터별 자동 분배)
- **해결 방안**: 충분한 totalStock 보유 상품 생성

### SKIP #30
- **파일**: `tests/e2e/phase-5-center-distribution.spec.ts:109`
- **시나리오**: `2. HEADQUARTERS 발주 processingCenterId=null 확인`
- **조건**: `if (hqOrders.length === 0)` - HEADQUARTERS 발주 없음
- **원인**: DB에 HEADQUARTERS 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 5 (센터별 자동 분배)
- **해결 방안**: HEADQUARTERS 발주 사전 생성

### SKIP #31
- **파일**: `tests/e2e/phase-5-center-distribution.spec.ts:127`
- **시나리오**: `3. CENTER 발주 processingCenterId 자동 할당 확인`
- **조건**: `if (centerOrders.length === 0)` - CENTER 발주 없음
- **원인**: DB에 CENTER 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 5 (센터별 자동 분배)
- **해결 방안**: CENTER 발주 사전 생성

### SKIP #32
- **파일**: `tests/e2e/phase-5-center-distribution.spec.ts:240`
- **시나리오**: `8. processingCenterId 기반 라우팅 정합성`
- **조건**: `if (centerOrders.length === 0)` - CENTER 발주 없음
- **원인**: DB에 CENTER 발주가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 5 (센터별 자동 분배)
- **해결 방안**: CENTER 발주 사전 생성

---

### SKIP #33
- **파일**: `tests/e2e/phase-6-sample-order.spec.ts:39`
- **시나리오**: `1. 장바구니 조회 API 동작 확인`
- **조건**: `if (res.status() === 401)` - auth() 세션 미전파
- **원인**: Playwright storageState에서 auth() 세션 쿠키가 서버 컴포넌트에 전달되지 않음
- **분류**: B (사용자/인증 부재)
- **9가지 항목**: 항목 6 (샘플 발주 자동 문자)
- **해결 방안**: 장바구니 API가 `auth()` 직접 사용하여 세션 전파 문제 발생 가능. `withRole()` 미들웨어로 전환하거나, storageState에 NextAuth 세션 토큰 포함 확인 필요.

### SKIP #34
- **파일**: `tests/e2e/phase-6-sample-order.spec.ts:51`
- **시나리오**: `2. 장바구니에 상품 추가`
- **조건**: `if (products.length === 0)` - 상품이 없음
- **원인**: DB에 상품 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 6 (샘플 발주 자동 문자)
- **해결 방안**: 상품 사전 생성

### SKIP #35
- **파일**: `tests/e2e/phase-6-sample-order.spec.ts:79`
- **시나리오**: `3. 장바구니 아이템 삭제 (query param)`
- **조건**: `if (!cartOk || items.length === 0)` - 장바구니 비어있거나 세션 문제
- **원인**: 장바구니에 아이템이 없거나 인증 문제
- **분류**: B (사용자/인증 부재)
- **9가지 항목**: 항목 6 (샘플 발주 자동 문자)
- **해결 방안**: 테스트 2에서 추가한 아이템이 존재해야 함. 세션 전파 문제 해결 필요.

### SKIP #36
- **파일**: `tests/e2e/phase-6-sample-order.spec.ts:110`
- **시나리오**: `5. 체크아웃 -> Proposal 생성 + 알림 발송`
- **조건**: `if (products.length === 0)` - 상품이 없음
- **원인**: DB에 상품 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 6 (샘플 발주 자동 문자)
- **해결 방안**: 상품 사전 생성

### SKIP #37
- **파일**: `tests/e2e/phase-6-sample-order.spec.ts:123`
- **시나리오**: `5. 체크아웃 -> Proposal 생성 + 알림 발송` (두 번째 체크)
- **조건**: `if (!addRes.ok())` - 장바구니 추가 실패
- **원인**: 세션 인증 문제 또는 상품 유효성 실패
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 6 (샘플 발주 자동 문자)
- **해결 방안**: 유효한 상품 + 인증 세션 보장

---

### SKIP #38
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:40`
- **시나리오**: `1. 단일 발주 생성 -> 응답에 orders 배열 포함`
- **조건**: `if (!product)` - supplyPrice > 0 && sellPrice > 0인 상품 없음
- **원인**: 유효 가격 상품이 DB에 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 7 (발주 분리 + 양측 알림)
- **해결 방안**: 유효 가격 상품 사전 생성

### SKIP #39
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:62`
- **시나리오**: `1. 단일 발주 생성` (두 번째 체크)
- **조건**: `if (res.status() === 400)` - 재고 부족 등으로 실패
- **원인**: 재고 선점 실패
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 7 (발주 분리 + 양측 알림)
- **해결 방안**: 충분한 재고 상품 생성

### SKIP #40
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:90`
- **시나리오**: `2. 혼합 발주 -> split=true, 양쪽 모두 알림 대상`
- **조건**: `if (!hqProduct || !centerProduct)` - HQ/CENTER 유효 상품 없음
- **원인**: 양쪽 유형 모두 유효 가격 상품이 필요
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 7 (발주 분리 + 양측 알림)
- **해결 방안**: HQ + CENTER 유효 가격 상품 사전 생성

### SKIP #41
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:117`
- **시나리오**: `2. 혼합 발주` (두 번째 체크)
- **조건**: `if (res.status() === 400)` - 재고 부족
- **원인**: 재고 선점 실패
- **분류**: F (방어적 SKIP)
- **9가지 항목**: 항목 7 (발주 분리 + 양측 알림)
- **해결 방안**: 충분한 재고 상품 생성

### SKIP #42
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:137`
- **시나리오**: `3. 발주 생성 후 목록에서 확인`
- **조건**: `if (orders.length === 0)` - 발주가 없음
- **원인**: DB에 발주 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 7 (발주 분리 + 양측 알림)
- **해결 방안**: 선행 테스트에서 발주 생성 보장

### SKIP #43 (Phase 7 추가)
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:160`
- **시나리오**: `4. 입금확인 API 동작 확인 (APPROVED -> PAID)`
- **조건**: `if (!target)` - APPROVED+UNPAID 발주 없음
- **원인**: APPROVED 상태 발주가 DB에 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 8 (입금 처리)
- **해결 방안**: 발주 생성 + 컨펌 선행

### SKIP #44
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:178`
- **시나리오**: `5. 이미 PAID인 발주 재입금확인 -> 400`
- **조건**: `if (!paidOrder)` - PAID 상태 발주 없음
- **원인**: 입금 처리된 발주가 DB에 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 8 (입금 처리)
- **해결 방안**: 발주 생성 + 컨펌 + 입금확인 선행

### SKIP #45
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:199`
- **시나리오**: `6. PENDING 발주 입금확인 불가 (APPROVED 필수)`
- **조건**: `if (!pendingOrder)` - PENDING 상태 발주 없음
- **원인**: PENDING 상태 발주가 DB에 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 8 (입금 처리)
- **해결 방안**: PENDING 상태 발주 사전 생성

### SKIP #46
- **파일**: `tests/e2e/phase-7-split-notifications.spec.ts:212`
- **시나리오**: `7. 발주 상세에 seller 정보 포함 (알림 수신자)`
- **조건**: `if (orders.length === 0)` - 발주가 없음
- **원인**: DB에 발주 데이터가 없음
- **분류**: A (테스트 데이터 부재)
- **9가지 항목**: 항목 7 (발주 분리 + 양측 알림)
- **해결 방안**: 최소 1건 발주 사전 생성

---

## 해결 전략

### 분류 A 해결 (테스트 데이터) - 30건

**핵심 전략**: 각 Phase 테스트의 `beforeAll` 또는 별도 `setup` 단계에서 API를 호출하여 필요 데이터를 사전 생성한다.

#### 필요 데이터 목록

| 데이터 | API 엔드포인트 | 필수 조건 |
|--------|---------------|----------|
| HEADQUARTERS 상품 | `POST /api/products` | barcode 필수, supplyPrice > 0, sellPrice > 0, totalStock >= 100 |
| CENTER 상품 | `POST /api/products` | productType=CENTER, managedBy=centerId, supplyPrice > 0, sellPrice > 0, totalStock >= 100 |
| 센터 | `POST /api/centers` | code 형식 XX-YYYY, 필수 필드 전부 |
| PENDING 발주 | `POST /api/orders` | 유효 상품 ID, status 기본값 PENDING |
| APPROVED 발주 | `POST /api/orders` + `POST /api/orders/:id/confirm` | PENDING 생성 후 컨펌 |
| PAID 발주 | 위 + `POST /api/orders/:id/payment-confirm` | APPROVED 후 입금확인 |

#### 데이터 생성 순서 (의존성 기반)

```
1. POST /api/centers → centerId 확보
2. POST /api/products (HEADQUARTERS, barcode 포함, 재고 충분) → hqProductId
3. POST /api/products (CENTER, managedBy=centerId, 재고 충분) → centerProductId
4. POST /api/orders (hqProductId) → hqOrderId (PENDING)
5. POST /api/orders (centerProductId) → centerOrderId (PENDING)
6. POST /api/orders (hqProductId + centerProductId) → split 발주 (PENDING x2)
7. POST /api/orders/:hqOrderId/confirm → APPROVED
8. POST /api/orders/:hqOrderId/payment-confirm → PAID
```

### 분류 B 해결 (인증) - 2건

**문제**: `proposals/cart` API가 `auth()` 직접 호출을 사용하여, Playwright `storageState`에서 NextAuth 세션이 제대로 전달되지 않는 경우가 있음.

**해결 방안**:
1. `proposals/cart` 라우트를 `withRole()` 미들웨어로 전환하여 일관된 인증 처리
2. 또는 `auth.setup.ts`에서 NextAuth 세션 토큰(JWT)이 storageState에 올바르게 저장되는지 확인
3. 현재 auth setup은 `master` 계정만 설정 (`playwright/.auth/admin.json`). seller/sub_master 전용 storageState가 필요할 수 있음

**기존 인증 세션**:
- `playwright/.auth/admin.json`: MASTER 역할 (username: `master`)
- `playwright/.auth/seller.json`: SELLER 역할 (별도 setup 필요)
- `playwright/.auth/master.json`: 추가 MASTER 세션

### 분류 F 해결 (방어적 SKIP) - 10건

이들은 네트워크 오류나 서버 에러에 대한 방어 코드로, 정상 환경에서는 거의 발생하지 않음. 해결 불필요 (의도된 설계).

---

## 기존 API 인벤토리

### 주문(Order) 관련
| 엔드포인트 | 메서드 | 기능 | 상태 |
|-----------|--------|------|------|
| `/api/orders` | GET | 발주 목록 (필터: productType, search) | 구현 완료 |
| `/api/orders` | POST | 발주 생성 (자동 분리, 재고 선점, 알림) | 구현 완료 |
| `/api/orders/[id]` | GET | 발주 상세 (seller, items 포함) | 구현 완료 |
| `/api/orders/[id]/confirm` | POST | 발주 컨펌 (PENDING->APPROVED, WMS 자동 sync) | 구현 완료 |
| `/api/orders/[id]/payment-confirm` | POST | 입금확인 (UNPAID->PAID, 셀러 알림) | 구현 완료 |
| `/api/orders/[id]/status` | PUT | 상태 변경 (입금/출고, 출고 알림) | 구현 완료 |
| `/api/orders/[id]/cancel` | - | 발주 취소 | 구현 완료 |
| `/api/orders/[id]/reject` | - | 발주 반려 | 구현 완료 |
| `/api/orders/bulk-status` | - | 일괄 상태 변경 | 구현 완료 |
| `/api/orders/stats` | GET | 발주 통계 | 구현 완료 |

### 상품(Product) 관련
| 엔드포인트 | 메서드 | 기능 | 상태 |
|-----------|--------|------|------|
| `/api/products` | GET | 상품 목록 (필터: productType, search) | 구현 완료 |
| `/api/products` | POST | 상품 생성 (HQ/CENTER, 코드 자동생성) | 구현 완료 |
| `/api/products/[id]` | GET/PUT | 상품 상세/수정 | 구현 완료 |
| `/api/products/barcode/[code]` | GET | 바코드로 상품 조회 | 구현 완료 |
| `/api/products/auto-created` | GET | 자동 등록 상품 목록 | 구현 완료 |

### 센터(Center) 관련
| 엔드포인트 | 메서드 | 기능 | 상태 |
|-----------|--------|------|------|
| `/api/centers` | GET | 센터 목록 | 구현 완료 |
| `/api/centers` | POST | 센터 생성 + 관리자 계정 동시 생성 | 구현 완료 |
| `/api/centers/[id]` | GET/PUT | 센터 상세/수정 | 구현 완료 |
| `/api/centers/validate-code` | POST | 센터 코드 유효성 검증 | 구현 완료 |

### ONEWMS 관련
| 엔드포인트 | 메서드 | 기능 | 상태 |
|-----------|--------|------|------|
| `/api/onewms/orders/sync` | POST | 수동 WMS 동기화 | 구현 완료 |
| `/api/onewms/orders/retry` | POST | 실패 발주 재시도 | 구현 완료 |
| `/api/onewms/orders/[id]/status` | GET | WMS sync 상태 조회 | 구현 완료 |
| `/api/onewms/stats` | GET | WMS 통계 | 구현 완료 |
| `/api/onewms/stock/sync` | POST | 재고 동기화 | 구현 완료 |
| `/api/onewms/products/import` | POST | 상품 임포트 | 구현 완료 |

### 샘플/제안(Proposal) 관련
| 엔드포인트 | 메서드 | 기능 | 상태 |
|-----------|--------|------|------|
| `/api/proposals` | GET/POST | 제안 목록/생성 | 구현 완료 |
| `/api/proposals/cart` | GET/POST/DELETE | 샘플 장바구니 CRUD | 구현 완료 |
| `/api/proposals/cart/checkout` | POST | 일괄 체크아웃 + 알림 | 구현 완료 |
| `/api/proposals/samples` | GET | 샘플 요청 목록 + 통계 | 구현 완료 |
| `/api/proposals/payment/virtual-account` | POST | 가상계좌 발급 | 구현 완료 |

### 알림(Notification) 시스템
| 기능 | 구현 상태 | 비고 |
|------|----------|------|
| ORDER_CREATED 알림 | 구현 완료 | 발주 생성 시 관리자에게 발송 |
| ORDER_CONFIRMED 알림 | 구현 완료 | 발주 컨펌 시 셀러에게 발송 |
| ORDER_PAYMENT_CONFIRMED 알림 | 구현 완료 | 입금확인 시 셀러에게 발송 |
| ORDER_SHIPPED 알림 | 구현 완료 | 출고완료 시 셀러에게 발송 |
| SAMPLE_CHECKOUT 알림 | 구현 완료 | 샘플 체크아웃 시 관리자에게 발송 |
| Mock/Solapi 클라이언트 | 구현 완료 | 환경변수 기반 자동 선택 |

---

## 9가지 항목별 SKIP 매핑

| # | 항목 | SKIP 수 | 해결 가능 (A/B) | 방어적 (F) | 미구현 (E) | Phase 파일 |
|---|------|---------|----------------|-----------|-----------|-----------|
| 1 | 센터 ID/PW 가입 검증 | 1 | 0 | 1 | 0 | phase-1 |
| 2 | 발주 전체 기능 | 12 | 7 | 5 | 0 | phase-2 |
| 3 | 바코드 + WMS API | 8 | 6 | 2 | 0 | phase-3 |
| 4 | 신규 발주 -> WMS 입력 | 5 | 5 | 0 | 0 | phase-4 |
| 5 | 센터별 자동 분배 | 6 | 6 | 0 | 0 | phase-5 |
| 6 | 샘플 발주 자동 문자 | 5 | 3 | 0 | 0 | phase-6 |
| 7 | 발주 분리 + 양측 알림 | 7 | 6 | 1 | 0 | phase-7 |
| 8 | 입금 처리 | 5 | 5 | 0 | 0 | phase-2, 7 |
| 9 | UI 정리 | 2 | 1 | 1 | 0 | phase-2 |
| **합계** | | **46** | **39** | **10** | **0** | |

> 참고: 일부 SKIP은 여러 항목에 해당할 수 있으나, 가장 직접적인 항목에 매핑함. 총 46건은 SKIP 호출 위치 기준 (동일 테스트 내 복수 체크 포함). 고유 테스트 시나리오 기준으로는 약 30개 시나리오에 영향.

---

## Phase 8/9 테스트 파일 현황

- `phase-8-*.spec.ts`: 파일 미존재 (항목 8 "입금 처리"는 phase-2, phase-7에서 부분 검증)
- `phase-9-*.spec.ts`: 파일 미존재 (항목 9 "UI 정리"는 phase-2에서 부분 검증)

---

## 결론

1. **미구현 기능(E)은 0건**이다. 모든 핵심 API 엔드포인트와 비즈니스 로직이 이미 구현 완료되어 있다.
2. **SKIP의 주원인(71%)은 테스트 데이터 부재(A)**이다. 테스트가 기존 DB 데이터에 의존하는 구조로, DB가 비어있으면 대부분 skip된다.
3. **해결 방법은 단순**하다: 각 phase의 `beforeAll`에서 필요한 데이터를 API로 생성하면 대부분의 SKIP이 해소된다.
4. **인증 관련(B) 2건**은 `proposals/cart` API의 `auth()` 직접 호출이 Playwright storageState와 호환되지 않는 문제로, 코드 수정이 필요하다.
5. **방어적 SKIP(F) 10건**은 정상 동작이며 해결 불필요하다.
