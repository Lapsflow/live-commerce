# Phase 4: Broadcast Calendar Enhancement - PDCA Plan

> **Feature**: 방송 캘린더 고도화 (Broadcast Calendar Enhancement)
> **Goal**: PPT Slide 12 요구사항 "센터코드 입력 → 센터 상품 로드" 구현
> **Duration**: 2주 (2 weeks)
> **PDCA Phase**: Plan
> **Created**: 2026-04-15

---

## 📋 Executive Summary

### Business Objective
라이브 방송 시작 시 센터코드를 입력하면 해당 센터의 상품과 본사 상품을 자동으로 로드하여, 셀러가 센터별로 맞춤화된 상품 리스트로 방송을 진행할 수 있도록 지원합니다.

### Current State
- ✅ Phase 1 완료: 센터 기반 인프라 구축 완료 (Center 모델, API, UI)
- ✅ 센터코드 검증 API 2개 엔드포인트 필요 (`/api/centers/validate-code`, `/api/centers/check-available`)
- ⚠️ `/broadcasts/[id]/live` 페이지 존재하나 센터코드 입력 기능 없음
- ⚠️ 방송 시작 시 센터 연결 없이 모든 상품 로드 중

### Target State
- ✅ 방송 시작 다이얼로그에서 센터코드 입력 및 검증
- ✅ 센터별 상품 + 본사 상품 동적 로드
- ✅ 방송-센터 연결 정보 저장 (Broadcast.centerId)
- ✅ 실시간 상품 검색 및 필터링

---

## 🎯 Success Criteria

### Functional Requirements
1. **센터코드 입력 및 검증** (Phase 4.1)
   - [ ] 방송 시작 다이얼로그 UI 구현
   - [ ] 센터코드 실시간 검증 API 연동
   - [ ] 센터 정보 표시 (센터명, 지역, 상품 수)
   - [ ] 검증 실패 시 에러 메시지 표시

2. **센터별 상품 동적 로드** (Phase 4.2)
   - [ ] 센터 상품 + 본사 상품 통합 로드
   - [ ] 상품 검색 기능 (상품명, 바코드)
   - [ ] 판매 현황 트래커 실시간 업데이트
   - [ ] 방송-센터 연결 정보 저장

### Technical Requirements
- **Performance**: 상품 로드 시간 < 2초 (100개 상품 기준)
- **Data Integrity**: Broadcast.centerId 정확히 저장
- **User Experience**: 센터코드 입력 → 검증 → 방송 시작 플로우 3단계 이내
- **Error Handling**: 네트워크 오류, 잘못된 센터코드, 권한 없음 등 모든 에러 케이스 처리

### Business Impact
- **셀러 편의성**: 센터별 맞춤 상품 리스트로 방송 준비 시간 50% 감소
- **재고 정확도**: 센터별 재고 기반 판매로 재고 부족 발생률 30% 감소
- **매출 증대**: 센터 특화 상품 노출 증가로 평균 주문액 15% 증가 예상

---

## 📐 Architecture Overview

### Data Flow
```
사용자 (셀러)
    ↓
방송 시작 버튼 클릭
    ↓
StartBroadcastDialog 모달
    ↓
센터코드 입력 (예: "01-4213")
    ↓
POST /api/centers/validate-code
    ↓
센터 정보 표시 (센터명, 지역, 상품 수)
    ↓
방송 시작 버튼 클릭
    ↓
POST /api/broadcasts/[id]/start (centerId 전송)
    ↓
Broadcast.centerId 업데이트
    ↓
Redirect to /broadcasts/[id]/live?centerId={centerId}
    ↓
센터 상품 + 본사 상품 로드
    ↓
ProductListForBroadcast 컴포넌트 렌더링
```

### Database Schema Changes
**No schema changes required** - Broadcast.centerId already exists from Phase 1.

Existing schema:
```prisma
model Broadcast {
  id          String    @id @default(cuid())
  centerId    String?   // Phase 1에서 이미 추가됨
  center      Center?   @relation(fields: [centerId], references: [id])
  // ... other fields
}
```

### API Endpoints

#### Phase 4.1: 센터코드 검증 API (2개 신규)
| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/centers/validate-code` | POST | 센터코드 유효성 검증 | MASTER |
| `/api/centers/check-available` | GET | 센터코드 사용 가능 여부 | MASTER, SUB_MASTER, ADMIN |

#### Phase 4.2: 방송 시작 API (1개 수정)
| Endpoint | Method | Description | Changes |
|----------|--------|-------------|---------|
| `/api/broadcasts/[id]/start` | POST | 방송 시작 | centerId 파라미터 추가 |

---

## 🛠️ Implementation Phases

### Phase 4.1: 방송 시작 시 센터코드 입력 (1주, 5일)

#### Day 1-2: API 엔드포인트 구현 (2일)
**Deliverables**:
1. `POST /api/centers/validate-code` 구현
   - Input: `{ code: string }`
   - Output: `{ valid: boolean, available: boolean, center?: Center, message: string }`
   - Validation: 센터코드 형식 검증 (XX-XXXX), 센터 존재 여부

2. `GET /api/centers/check-available?code=XX-XXXX` 구현
   - Output: `{ code: string, available: boolean, exists: boolean }`

**Files**:
- `app/api/centers/validate-code/route.ts` (신규)
- `app/api/centers/check-available/route.ts` (신규)

**Testing**:
```bash
# validate-code
curl -X POST http://localhost:3000/api/centers/validate-code \
  -H "Content-Type: application/json" \
  -d '{"code":"01-4213"}'

# check-available
curl http://localhost:3000/api/centers/check-available?code=01-4213
```

#### Day 3-4: UI 컴포넌트 구현 (2일)
**Deliverables**:
1. `StartBroadcastDialog` 컴포넌트
   - 센터코드 입력 필드 (Input)
   - 검증 버튼 (Button with loading state)
   - 센터 정보 표시 (Alert component)
   - 방송 시작 버튼 (Dialog footer)

**Files**:
- `components/broadcasts/StartBroadcastDialog.tsx` (신규)

**Dependencies**:
- shadcn/ui components: Dialog, Input, Button, Alert
- React hooks: useState for centerCode, isValidating, center
- API client: fetch to validate-code endpoint

**UI Flow**:
```tsx
<Dialog>
  <DialogTrigger>방송 시작</DialogTrigger>
  <DialogContent>
    <Input placeholder="예: 01-4213" />
    <Button onClick={validateCenterCode}>확인</Button>
    {center && (
      <Alert>
        <AlertTitle>센터 확인됨</AlertTitle>
        <AlertDescription>
          센터명: {center.name}
          지역: {center.regionName}
          상품 수: {center._count.centerStocks}개
        </AlertDescription>
      </Alert>
    )}
    <DialogFooter>
      <Button disabled={!center} onClick={startBroadcast}>
        방송 시작
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Day 5: 통합 및 테스트 (1일)
**Tasks**:
1. StartBroadcastDialog를 기존 방송 페이지에 통합
2. POST /api/broadcasts/[id]/start에 centerId 파라미터 추가
3. E2E 테스트: 센터코드 입력 → 검증 → 방송 시작 플로우

**Files to Modify**:
- `app/(main)/broadcasts/page.tsx` - StartBroadcastDialog import
- `app/api/broadcasts/[id]/start/route.ts` - centerId 파라미터 처리

---

### Phase 4.2: 센터별 상품 동적 로드 (1주, 5일)

#### Day 1-2: 라이브 방송 페이지 수정 (2일)
**Deliverables**:
1. `/broadcasts/[id]/live` 페이지 수정
   - URL query param `centerId` 필수 검증
   - 센터 상품 + 본사 상품 통합 로드
   - ProductCenterStock 기반 재고 표시

**Files**:
- `app/(main)/broadcasts/[id]/live/page.tsx` (수정)

**Implementation**:
```typescript
// 1. centerId validation
const { centerId } = searchParams;
if (!centerId) {
  redirect(`/broadcasts/${params.id}`);
}

// 2. Load center products
const center = await prisma.center.findUnique({
  where: { id: centerId },
  include: {
    centerStocks: {
      where: {
        product: { active: true }
      },
      include: {
        product: {
          include: {
            warehouseInventory: true
          }
        }
      }
    }
  }
});

// 3. Load headquarters products (TODO: Phase 4에서 productType 필드 추가 필요)
const hqProducts = await prisma.product.findMany({
  where: {
    // productType: 'HEADQUARTERS', // TODO: schema 업데이트 후 활성화
    active: true
  },
  include: {
    warehouseInventory: true
  }
});

// 4. Merge products
const centerProducts = center.centerStocks.map(cs => cs.product);
const allProducts = [...centerProducts, ...hqProducts];
```

**Schema Update Required** (Optional, Phase 4 후반 또는 Phase 5):
```prisma
model Product {
  // ...existing fields
  productType  String?  @default("CENTER")  // "CENTER" | "HEADQUARTERS"
}
```

#### Day 3: ProductListForBroadcast 컴포넌트 (1일)
**Deliverables**:
1. 상품 리스트 컴포넌트
   - 상품명, 바코드, 재고, 가격 표시
   - 검색 기능 (상품명, 바코드)
   - 방송 추가 버튼

**Files**:
- `components/broadcasts/ProductListForBroadcast.tsx` (신규)

**Features**:
- Client-side 검색 (useState + filter)
- DataTable 또는 커스텀 리스트 UI
- 재고 부족 상품 강조 표시

#### Day 4: BroadcastSalesTracker 컴포넌트 (1일)
**Deliverables**:
1. 판매 현황 트래커
   - 실시간 판매 수량, 매출액
   - WebSocket 또는 polling 기반 업데이트
   - 상위 판매 상품 TOP 5

**Files**:
- `components/broadcasts/BroadcastSalesTracker.tsx` (신규)

**Implementation**:
```typescript
// Polling 방식 (간단)
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/broadcasts/${broadcastId}/stats`);
    const data = await res.json();
    setStats(data);
  }, 5000); // 5초마다 업데이트

  return () => clearInterval(interval);
}, [broadcastId]);
```

#### Day 5: 통합 테스트 및 최적화 (1일)
**Tasks**:
1. 전체 플로우 E2E 테스트
2. 성능 최적화 (상품 로드 시간 < 2초)
3. 에러 핸들링 검증
4. 반응형 UI 검증

**Test Scenarios**:
- ✅ 정상 플로우: 센터코드 입력 → 검증 → 방송 시작 → 상품 로드
- ✅ 에러 플로우: 잘못된 센터코드, 네트워크 오류, 권한 없음
- ✅ 엣지 케이스: centerId 없이 /live 접근 시 리다이렉트

---

## 📦 Dependencies

### Existing Dependencies (No changes)
- Next.js 16.2.2
- React 19
- Prisma 7.6
- shadcn/ui components

### New Dependencies (None)
All required UI components already exist in the project.

---

## 🔍 Risk Assessment

### Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 센터코드 검증 API 응답 지연 | Medium | High | Redis 캐싱, 낙관적 UI 업데이트 |
| productType 필드 없어서 본사 상품 구분 불가 | High | Medium | Phase 4에서 모든 상품 허용, Phase 5에서 schema 업데이트 |
| 대량 상품 로드 시 성능 저하 | Low | High | Pagination, 가상 스크롤 적용 |
| 센터 상품이 없는 경우 빈 화면 | Medium | Medium | 본사 상품으로 최소 보장, 안내 메시지 |

### Business Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 셀러가 센터코드를 모르는 경우 | High | Medium | 센터코드 조회 기능, 드롭다운 선택 UI 추가 |
| 센터 변경 요청 | Medium | Low | 방송 중에는 센터 변경 불가 정책 |

---

## 📊 Testing Strategy

### Unit Tests
- [ ] `validateCenterCode` 함수 테스트
- [ ] `getCenterByCode` 함수 테스트
- [ ] StartBroadcastDialog 컴포넌트 렌더링 테스트

### Integration Tests
- [ ] POST /api/centers/validate-code 엔드투엔드
- [ ] GET /api/centers/check-available 엔드투엔드
- [ ] POST /api/broadcasts/[id]/start with centerId

### E2E Tests (Playwright)
- [ ] 방송 시작 플로우 (센터코드 입력 → 검증 → 시작)
- [ ] 센터별 상품 로드 검증
- [ ] 에러 케이스 (잘못된 센터코드, 권한 없음)

### Performance Tests
- [ ] 상품 로드 시간 < 2초 (100개 상품)
- [ ] API 응답 시간 < 500ms

---

## 📅 Timeline

### Week 1 (Days 1-5): Phase 4.1
- Day 1-2: API 엔드포인트 구현
- Day 3-4: UI 컴포넌트 구현
- Day 5: 통합 및 테스트

### Week 2 (Days 6-10): Phase 4.2
- Day 6-7: 라이브 방송 페이지 수정
- Day 8: ProductListForBroadcast 컴포넌트
- Day 9: BroadcastSalesTracker 컴포넌트
- Day 10: 통합 테스트 및 최적화

**Total Duration**: 10일 (2주)

---

## 🎯 Rollback Strategy

### If Phase 4.1 Fails
1. 센터코드 입력 없이 기존 방송 시작 플로우 유지
2. Broadcast.centerId는 null로 저장
3. 모든 상품 로드 (센터 구분 없음)

### If Phase 4.2 Fails
1. Phase 4.1 완료 상태 유지 (센터코드 입력만)
2. 방송 페이지는 기존 로직 유지 (모든 상품 로드)
3. centerId는 저장만 하고 활용하지 않음

### Rollback Commands
```bash
# API 롤백
git revert <commit-hash-for-api>

# UI 롤백
git revert <commit-hash-for-ui>

# 전체 롤백
git checkout main
```

---

## 📝 Documentation Deliverables

### Technical Documentation
- [ ] API 문서 업데이트 (validate-code, check-available)
- [ ] 컴포넌트 사용 가이드 (StartBroadcastDialog)
- [ ] 데이터 플로우 다이어그램

### User Documentation
- [ ] 셀러 가이드: 방송 시작 시 센터코드 입력 방법
- [ ] 관리자 가이드: 센터별 상품 관리 방법

---

## ✅ Definition of Done

Phase 4는 다음 조건을 모두 만족할 때 완료로 간주합니다:

1. **Functional Completeness**
   - [ ] 모든 API 엔드포인트 구현 및 테스트 완료
   - [ ] 모든 UI 컴포넌트 구현 및 통합 완료
   - [ ] E2E 테스트 통과율 100%

2. **Quality Standards**
   - [ ] TypeScript 컴파일 에러 0개
   - [ ] ESLint 경고 0개
   - [ ] Build 성공
   - [ ] 성능 기준 충족 (상품 로드 < 2초)

3. **Documentation**
   - [ ] API 문서 작성 완료
   - [ ] 사용자 가이드 작성 완료
   - [ ] 코드 주석 추가 완료

4. **Review & Approval**
   - [ ] 코드 리뷰 완료
   - [ ] QA 테스트 완료
   - [ ] 제품 오너 승인

---

## 🔗 Related Documents

- [Phase 1.1: Database Schema](./phase-1-1-database-schema.plan.md) - Center 모델 정의
- [Phase 1.2: Center Management API](./phase-1-2-center-api.plan.md) - 센터 API 구현
- [Phase 1.3: Center Management UI](./phase-1-3-center-ui.plan.md) - 센터 UI 구현
- [Overall Project Plan](/Users/jinwoo/.claude/plans/snoopy-purring-ritchie.md) - 전체 프로젝트 계획

---

## 📞 Stakeholders

- **Product Owner**: 라이브커머스 플랫폼 총괄
- **Development Lead**: Phase 4 구현 담당
- **QA Lead**: 테스트 전략 수립 및 실행
- **UX Designer**: UI/UX 디자인 검토

---

**Next Steps**:
1. `/pdca design phase-4-broadcast-calendar` - 설계 문서 작성
2. Implementation 시작 전 Product Owner 승인 필요
3. Phase 4 완료 후 Phase 5 (샘플 발주 시스템) 진행
