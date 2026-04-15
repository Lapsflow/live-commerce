'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface StockSyncButtonProps {
  productId: string;
}

interface ProductStockInfo {
  product: {
    id: string;
    code: string;
    name: string;
    totalStock: number;
    onewmsCode: string | null;
  };
  lastSync: {
    syncedAt: Date;
    onewmsAvailableQty: number;
    onewmsTotalQty: number;
    difference: number;
    syncStatus: string;
  } | null;
  hasConflict: boolean;
}

interface StockApiResponse {
  data: ProductStockInfo;
}

export function StockSyncButton({ productId }: StockSyncButtonProps) {
  // 1. 재고 정보 조회
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: async () => {
      const res = await fetch(`/api/onewms/stock/${productId}`);
      if (!res.ok) throw new Error('Failed to fetch stock');
      const response = await res.json() as StockApiResponse;
      return response.data;
    },
  });

  // 2. 동기화 Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/stock/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('재고 동기화가 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재고 동기화에 실패했습니다');
    },
  });

  if (isLoading) {
    return <Button disabled size="sm">로딩 중...</Button>;
  }

  if (!data || !data.product.onewmsCode) {
    return <Button disabled size="sm">ONEWMS 코드 없음</Button>;
  }

  if (!data.lastSync) {
    return <Button disabled size="sm">동기화 기록 없음</Button>;
  }

  const hasConflict = Math.abs(data.lastSync.difference) > 5;

  return (
    <div className="space-y-2">
      {/* 재고 정보 */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">플랫폼:</span>
          <span className="ml-1 font-medium">{data.product.totalStock}</span>
        </div>
        <div>
          <span className="text-muted-foreground">ONEWMS:</span>
          <span className="ml-1 font-medium">{data.lastSync.onewmsAvailableQty}</span>
        </div>
        {data.lastSync.difference !== 0 && (
          <div className={hasConflict ? 'text-red-600 font-medium' : 'text-yellow-600'}>
            차이: {data.lastSync.difference > 0 ? '+' : ''}{data.lastSync.difference}
          </div>
        )}
      </div>

      {/* 충돌 경고 */}
      {hasConflict && (
        <div className="flex items-center gap-2 rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          <span>재고 차이가 큽니다. 수동 확인이 필요합니다.</span>
        </div>
      )}

      {/* 동기화 버튼 */}
      <Button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        size="sm"
        variant="outline"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
        {syncMutation.isPending ? '동기화 중...' : '재고 동기화'}
      </Button>

      {/* 마지막 동기화 */}
      {data.lastSync.syncedAt && (
        <div className="text-xs text-muted-foreground">
          마지막 동기화:{' '}
          {formatDistanceToNow(new Date(data.lastSync.syncedAt), {
            addSuffix: true,
            locale: ko,
          })}
        </div>
      )}
    </div>
  );
}

export default StockSyncButton;
