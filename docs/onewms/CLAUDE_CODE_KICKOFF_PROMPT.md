# Claude Code 킥오프 프롬프트 (복붙용)

> 사용법: 아래 ``` 안의 내용을 그대로 복사해서 Claude Code 새 세션에 붙여넣으세요.

---

```
# 미션
ONEWMS API 호출 핫픽스 — 운영에서 발주 컨펌 시 ONEWMS 가 100% 거부 중인 사일런트 실패를 종결한다.

# 진행 방식
1. 먼저 `docs/onewms/HOTFIX_PROMPT_FOR_CLAUDE_CODE.md` 를 정독한다.
2. 함께 읽을 컨텍스트:
   - `CLAUDE.md` (보리스 원칙 + 학습 기록 — 절대 어기지 말 것)
   - `docs/onewms/00-INDEX.md` (공식 API 인덱스)
   - `docs/onewms/02-set_orders.md` (핵심 갭)
   - `docs/onewms/99-GAP_ANALYSIS.md` (전체 차이)
3. 보리스 원칙 #4 적용 — **코드 한 줄도 작성하지 말고 먼저 written plan 을 출력**한다.
   plan 에는 다음을 포함:
   - 변경 파일 목록과 각 파일에서 무엇을 바꿀지
   - 타입 변경의 영향 범위 (grep 결과로 입증)
   - `set_orders` JSON 배열을 form-encode 할 때 어떤 키로 보낼지 가정과 그 근거
   - 마이그레이션 필요 여부 판단
   - 롤백 절차
4. plan 을 보고 사용자 ("go") 가 승인하면 코드 작성에 들어간다.
5. 작업은 지시서 (HOTFIX_PROMPT_FOR_CLAUDE_CODE.md) 의 Step 2~8 순서대로 진행.
6. 매 Step 완료 시 변경 diff 를 보여주고 다음 Step 진행.
7. Step 9 (검증) 에서 `pnpm tsc --noEmit && pnpm lint && pnpm build` 모두 PASS 까지 책임.

# 절대 금지 (학습 기록)
- 운영 사이드바 (`components/layout/sidebar.tsx`) 확인 없이 `/admin/...` 경로 만들기 (학습 #1)
- 운영 도메인을 `live-commerce-opal.vercel.app` 로 표기 (학습 #2 — 운영은 `www.supermujin.ai`)
- `withRole` 핸들러 안에서 `auth()` 재호출 (학습 #4)
- NextAuth 핸들러 (`app/api/auth/`) 수정
- Prisma 마이그레이션을 샌드박스에서 `prisma generate` 실행 (학습 #7 — 사용자 로컬에서)
- 페이지네이션 없는 목록 API 신설 (학습 #10)
- ".env.local" 을 git 에 커밋
- Playwright "100% PASS" 만 보고 위젯 → 다음 페이지 동선 검증 누락 (학습 #8)
- API 응답 구조 `{data: T}` 래퍼 확인 없이 클라이언트 fetch (학습 #9)

# 결과물 (6가지)
작업 종료 시 다음을 정리해서 출력:

## ONEWMS P0 핫픽스 완료 보고

### 1. 변경 요약
- 파일 N개 수정 / M개 신규 / 0개 삭제
- 타입체크: PASS/FAIL / 빌드: PASS/FAIL / 린트: PASS/FAIL (warning 수)

### 2. 변경 파일 목록 (path:line 형식)
- lib/onewms/types.ts:148-160 → CreateOrderRequest 재정의
- ...

### 3. 각 파일 핵심 diff
(>30줄이면 요약 + 핵심 hunk)

### 4. 부트스트랩 스크립트 실행 결과
- 실제 ONEWMS 키 없이는 mock 출력만 가능 — 그 사실 명시

### 5. 남은 작업 (P1)
- set_trans_pos / cancel_trans_pos / set_order_label / add_product 필드명 정리
- add_sheet / get_onedas_* 필드명 정리

### 6. 롤백 가이드
- 문제 시 `git revert <commit-sha>` 한 줄로 끝나도록 단일 커밋 권장

# 의문은 즉시 질문
플랜 단계에서 가정해야 할 부분 (예: set_orders 의 JSON 배열 키명, order.memo 컬럼 존재 여부 등) 은 추측 말고 사용자에게 물어볼 것.

시작하라.
```

---

## 사용자가 클로드코드 작업 후 할 일

1. 클로드코드의 완료 보고서를 받음
2. 보고서 + 변경된 파일 경로 목록을 Cowork (저) 에 전달
3. 저는 다음 항목으로 검증:
   - [ ] Plan-first (보리스 #4) 지켰는지
   - [ ] 보고서 6개 항목 모두 채워졌는지
   - [ ] 코드 diff 가 지시서와 일치하는지
   - [ ] `shop_id` 필수 가드 (config.ts) 들어갔는지
   - [ ] `getOrderInfo` 의 `order_no` 파라미터 제거됐는지
   - [ ] `orderSync.ts` 의 필드명이 `recv_*` 로 모두 바뀌었는지
   - [ ] 학습 #9 (응답 구조), #10 (페이지네이션) 위반 없는지
   - [ ] tsc/lint/build 실제 PASS 했는지
   - [ ] 잔여 P1 항목이 누락 없이 정리됐는지
