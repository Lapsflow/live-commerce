# Products Components

## StockSyncButton

개별 상품의 재고를 ONEWMS와 수동으로 동기화하는 버튼 컴포넌트입니다.

### 사용법

```tsx
import StockSyncButton from '@/app/(main)/products/components/stock-sync-button';

// 기본 사용
<StockSyncButton productId="prod_123" />

// 상품명과 콜백 포함
<StockSyncButton
  productId="prod_123"
  productName="상품명"
  onSyncComplete={(success) => {
    if (success) {
      // 재고 새로고침 등
      refetch();
    }
  }}
/>

// 커스터마이징
<StockSyncButton
  productId="prod_123"
  variant="ghost"
  size="icon"
  showLabel={false}
/>
```

### Props

- `productId` (required): 상품 ID
- `productName` (optional): 확인 메시지에 표시할 상품명
- `onSyncComplete` (optional): 동기화 완료 후 콜백 (success: boolean)
- `variant` (optional): 버튼 스타일 ('default' | 'outline' | 'ghost')
- `size` (optional): 버튼 크기 ('default' | 'sm' | 'lg' | 'icon')
- `showLabel` (optional): 레이블 표시 여부 (기본: true)

### 기능

1. **재고 동기화**: 클릭 시 ONEWMS API를 호출하여 실시간 재고 동기화
2. **충돌 감지**: 재고 차이가 있을 경우 경고 메시지 표시
3. **상태 표시**: 동기화 중, 성공, 실패 상태를 아이콘으로 표시
4. **확인 대화상자**: 실수로 클릭하지 않도록 확인 메시지

### API 의존성

- POST `/api/onewms/stock/sync` - 재고 동기화 API
