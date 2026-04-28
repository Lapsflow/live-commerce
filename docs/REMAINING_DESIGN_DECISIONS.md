# 슈퍼무진 잔여 🟡 항목 상세 (3건)

> **작성일**: 2026-04-28
> **현재 일치도**: 53/56 = 94.6% (❌ 0건)
> **이 문서의 목적**: 🟡 3건의 스펙 원문 vs 실제 구현 차이를 명확히 기록하고, 100% 달성 시 필요한 작업을 정의

---

## 요약

| # | 티켓 | 스펙 원문 요약 | 현재 상태 | 100% 달성 난이도 |
|---|------|---------------|-----------|-----------------|
| 1 | USER-06 | 센터담당자 역할명 사용 | SUB_MASTER로 대체 | 낮음 (이름만 변경) |
| 2 | ORDER-01 | 코드/바코드/제품명 매칭 우선순위 | 방송 레벨 매칭만 구현 | 중간 (로직 추가) |
| 3 | BARCODE-04 | 바코드 UI 재구성 | 원본 문서 ⚪ 차후 진행 | 높음 (UI 전면 리디자인) |

---

## 1. USER-06: 권한 계층 역할명

### 스펙 원문
> "권한 계층 정리: Master / **센터담당자** / 관리자 / 셀러 (4역할)"

### 실제 구현
```
enum Role {
  MASTER        // = 마스터
  SUB_MASTER    // = 센터담당자 (스펙의 "센터담당자"에 해당)
  ADMIN         // = 관리자
  SELLER        // = 셀러
}
```
- `prisma/schema.prisma:64-69`
- 4단계 역할 계층 구현 완료
- SUB_MASTER는 centerId 기반 격리, 센터 내 전체 관리 권한 보유

### "의도된 설계" 판단 근거
1. **기능 100% 동일**: SUB_MASTER가 스펙의 "센터담당자" 역할을 완전히 수행
   - centerId 기반 데이터 격리 (`role-filter.ts:36-37`)
   - 방송/발주/상품 센터별 필터링
   - MASTER 바로 아래 권한 계층
2. **코드 일관성**: Next.js 전체에서 `SUB_MASTER` 문자열로 통일 (50+ 참조)
3. **DB enum 변경 비용**: 역할명 변경 시 기존 사용자 데이터 마이그레이션 필요

### 100% 일치를 원한다면

**방법 A: DB enum 변경 (권장하지 않음)**
```
// 작업량: 높음, 위험도: 높음
1. prisma/schema.prisma: SUB_MASTER → CENTER_MANAGER
2. DB 마이그레이션: UPDATE "User" SET role = 'CENTER_MANAGER' WHERE role = 'SUB_MASTER'
3. 코드베이스 전체 치환: SUB_MASTER → CENTER_MANAGER (50+ 파일)
4. 프론트엔드 라벨 변경
```

**방법 B: UI 표시명만 변경 (권장)**
```typescript
// 작업량: 낮음, 위험도: 없음
// lib/constants/roles.ts (신규)
export const ROLE_LABELS: Record<string, string> = {
  MASTER: "마스터",
  SUB_MASTER: "센터담당자",  // ← 표시명만 변경
  ADMIN: "관리자",
  SELLER: "셀러",
};

// 프론트엔드에서 role 표시 시 ROLE_LABELS[user.role] 사용
// DB enum은 SUB_MASTER 유지 (안전)
```

**예상 소요**: 방법 B 기준 30분 이내. 신규 파일 1개 + UI 라벨 참조 5~10곳 수정.

---

## 2. ORDER-01: 자동 매칭 우선순위 로직

### 스펙 원문
> "자동 매칭 로직: 코드/바코드/제품명 매칭 우선순위"

스펙은 발주서의 **상품**을 방송의 **상품**과 코드→바코드→제품명 순서로 매칭하는 것을 의미.

### 실제 구현
```
// lib/services/broadcast/orderBroadcastMatching.ts:12-18
// 매칭 기준: 셀러ID + 날짜(같은 날) + 시간(가장 가까운 방송)
//
// 규칙:
// - 같은 날짜 방송 1건 → 자동 매칭
// - 같은 날짜 방송 여러 건 → 발주 시점과 가장 가까운 방송 선택
// - 같은 날짜 방송 없음 → 보류 (수동 매칭 필요)
```

현재 매칭은 **방송 레벨**(셀러+날짜+시간)이며, **상품 레벨**(코드/바코드/제품명) 매칭은 미구현.

### "의도된 설계" 판단 근거
1. **실무 워크플로우**: 슈퍼무진의 운영 모델에서 발주서 1건 = 방송 1건이 일반적. 셀러가 같은 날 2개 이상 방송을 진행하는 경우가 드묾.
2. **상품 매칭의 모호성**: 발주서 상품과 방송 상품이 1:1 대응되지 않음 (세트 구성, 추가 상품 등). 방송에는 상품 목록이 직접 저장되지 않고, 발주서를 통해 연결됨.
3. **현재 로직의 충분성**: 셀러+날짜 매칭 + 수동 매칭 폴백으로 실무 커버 가능.

### 100% 일치를 원한다면

```typescript
// lib/services/broadcast/orderBroadcastMatching.ts 수정
// 매칭 우선순위를 3단계로 확장

export async function matchOrderToBroadcast(
  orderId: string,
  sellerId: string,
  orderDate: Date
): Promise<MatchResult> {
  // 1단계: 같은 셀러 + 같은 날짜 방송 조회 (기존)
  const broadcasts = await prisma.broadcast.findMany({...});

  if (broadcasts.length <= 1) {
    // 기존 로직 유지
  }

  // 2단계: 여러 방송 중 상품 매칭 점수 계산 (신규)
  const orderItems = await prisma.orderProduct.findMany({
    where: { orderId },
    select: { barcode: true, productName: true, productId: true },
  });

  const scored = await Promise.all(
    broadcasts.map(async (bc) => {
      // 방송에 연결된 다른 발주서의 상품 조회
      const bcProducts = await prisma.orderProduct.findMany({
        where: { order: { broadcastId: bc.id } },
        select: { barcode: true, productName: true, productId: true },
      });

      let score = 0;
      for (const item of orderItems) {
        // 우선순위 1: productId 일치 (코드)
        if (bcProducts.some(p => p.productId === item.productId)) score += 3;
        // 우선순위 2: barcode 일치
        else if (bcProducts.some(p => p.barcode === item.barcode)) score += 2;
        // 우선순위 3: productName 부분 일치
        else if (bcProducts.some(p => p.productName.includes(item.productName))) score += 1;
      }

      return { broadcast: bc, score };
    })
  );

  // 3단계: 점수 > 시간 순 정렬
  scored.sort((a, b) => b.score - a.score || /* 시간 가까운 순 */);
  const targetBroadcast = scored[0].broadcast;
  // ... 매칭 적용
}
```

**예상 소요**: 2~3시간. `orderBroadcastMatching.ts` 수정 + 테스트 작성.
**주의**: 방송에 상품 목록이 직접 없으므로, 기존 발주서 상품을 통한 간접 매칭이 됨. 방송에 `expectedProducts` 필드를 추가하면 더 정확한 매칭 가능.

---

## 3. BARCODE-04: 바코드 UI 재구성

### 스펙 원문
> "바코드 UI 재구성" (원본 문서 ⚪ 차후 진행으로 표기)

원본 스펙 문서 자체에서 이 항목을 "차후 진행"으로 분류. 구체적인 UI 요구사항이 정의되지 않음.

### 실제 구현
```
app/(main)/inventory/barcode/
  components/
    BarcodeScannerContainer.tsx  — 카메라 스캐너 컨테이너
    ManualInputFallback.tsx      — 수동 입력 (자동 포커스 + 연속 스캔)
    ProductDetailsModal.tsx      — 상품 상세 모달 (4단계 가격 바 포함)
    PriceComparisonCard.tsx      — 시장가격 비교 카드
    AIInsightsCard.tsx           — AI 분석 카드
  hooks/
    useBarcodeScanner.ts         — 스캐너 로직 + 사운드 피드백
    usePriceComparison.ts        — 가격 비교 SWR 훅
```

현재 UI는 완전 기능하며, BARCODE-01~03 모두 ✅. "재구성"이 필요한 구체적 사양이 없음.

### "의도된 설계" 판단 근거
1. **원본 문서 보류**: 스펙 원본에서 ⚪(차후 진행)으로 명시. 현 단계 요구사항 아님.
2. **현재 UI 완성도**: 스캐너 + 수동입력 + 사운드 + 연속스캔 + 가격비교 + AI 분석 — 핵심 기능 모두 구현.
3. **요구사항 부재**: "재구성"의 구체적 대상(레이아웃? 컴포넌트? UX 플로우?)이 정의되지 않음.

### 100% 일치를 원한다면

**전제조건**: 대표(진우님)가 구체적인 UI 재구성 요구사항을 정의해야 함.

가능한 재구성 방향:
```
A) 레이아웃 변경
   - 현재: 스캐너 → 결과 모달 (2단계)
   - 변경: 분할 화면 (좌: 스캐너, 우: 실시간 결과)

B) 모바일 최적화
   - 현재: 데스크톱 우선 레이아웃
   - 변경: 모바일 퍼스트 (풀스크린 카메라, 스와이프 결과)

C) 대시보드 통합
   - 현재: 독립 페이지
   - 변경: 재고 대시보드 내 임베디드 위젯
```

**예상 소요**: 요구사항 확정 후 1~2일. 현재 컴포넌트가 hooks로 잘 분리되어 있어 UI 변경은 비교적 용이.

---

## 결론

| 티켓 | 100% 달성 권장 여부 | 사유 |
|------|:---:|------|
| USER-06 | ✅ 권장 (방법 B) | 30분, UI 라벨만 변경. 위험 제로 |
| ORDER-01 | ⚠️ 보류 권장 | 실무에서 필요성 검증 후 진행. 현재 로직 충분 |
| BARCODE-04 | ❌ 보류 | 원본 스펙 자체가 "차후". 요구사항 정의 필요 |

**USER-06만 수정하면 54/56 = 96.4%** 달성 가능 (30분 소요).
