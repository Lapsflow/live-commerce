'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface OnewmsStats {
  isConnected: boolean;
  lastSyncAt: string;
  stats: {
    pendingOrders: number;
    failedOrders: number;
    conflictCount: number;
  };
}

export function OnewmsStatusWidget() {
  // 1. API 호출 (30초마다 자동 갱신)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['onewms-stats'],
    queryFn: async () => {
      const res = await fetch('/api/onewms/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<OnewmsStats>;
    },
    refetchInterval: 30000,
  });

  // 2. 재고 동기화 Mutation
  const syncStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/stock/sync', { method: 'POST' });
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

  // 3. 실패 재시도 Mutation
  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/orders/retry', { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('실패한 주문 재시도가 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재시도에 실패했습니다');
    },
  });

  if (isLoading) {
    return <Card className="animate-pulse h-[200px]" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ONEWMS 연동 상태</CardTitle>
        <Badge variant={data?.isConnected ? 'default' : 'destructive'}>
          {data?.isConnected ? '연결됨' : '연결 끊김'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data?.stats.pendingOrders || 0}</div>
              <div className="text-sm text-muted-foreground">대기 주문</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">
                {data?.stats.failedOrders || 0}
              </div>
              <div className="text-sm text-muted-foreground">실패 주문</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {data?.stats.conflictCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">재고 충돌</div>
            </div>
          </div>

          {/* 마지막 동기화 */}
          {data?.lastSyncAt && (
            <div className="text-sm text-muted-foreground">
              마지막 동기화:{' '}
              {formatDistanceToNow(new Date(data.lastSyncAt), {
                addSuffix: true,
                locale: ko,
              })}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Button
              onClick={() => syncStockMutation.mutate()}
              disabled={syncStockMutation.isPending}
              size="sm"
            >
              {syncStockMutation.isPending ? '동기화 중...' : '재고 동기화'}
            </Button>
            <Button
              onClick={() => retryFailedMutation.mutate()}
              disabled={retryFailedMutation.isPending || (data?.stats.failedOrders === 0)}
              variant="outline"
              size="sm"
            >
              {retryFailedMutation.isPending ? '재시도 중...' : '실패 재시도'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
