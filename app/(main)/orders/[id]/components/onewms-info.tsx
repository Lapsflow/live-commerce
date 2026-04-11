'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface OnewmsInfoProps {
  orderId: string;
}

interface OnewmsOrderStatus {
  onewmsOrderNo: string;
  transNo?: string;
  status: 'pending' | 'sent' | 'shipped' | 'failed';
  csStatus: number;
  holdStatus: number;
  sentAt?: string;
  lastSyncAt?: string;
  errorMessage?: string;
}

export function OnewmsInfo({ orderId }: OnewmsInfoProps) {
  const { data: session } = useSession();
  const canManage = session?.user?.role === 'MASTER' || session?.user?.role === 'ADMIN';

  // 1. ONEWMS 정보 조회
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['onewms-order', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/onewms/orders/${orderId}/status`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<OnewmsOrderStatus | null>;
    },
  });

  // 2. 재전송 Mutation
  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error('Resend failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('ONEWMS 재전송이 완료되었습니다');
      refetch();
    },
    onError: () => {
      toast.error('재전송에 실패했습니다');
    },
  });

  if (isLoading) {
    return <Card className="animate-pulse h-[150px]" />;
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ONEWMS 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">ONEWMS 전송 전</p>
          {canManage && (
            <Button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              size="sm"
              className="mt-4"
            >
              {resendMutation.isPending ? '전송 중...' : 'ONEWMS 전송'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    shipped: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }[data.status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>ONEWMS 정보</span>
          <Badge className={statusColor}>{data.status.toUpperCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* ONEWMS 주문번호 */}
          <div>
            <div className="text-sm font-medium">ONEWMS 주문번호</div>
            <div className="text-sm text-muted-foreground">{data.onewmsOrderNo}</div>
          </div>

          {/* 송장번호 */}
          {data.transNo && (
            <div>
              <div className="text-sm font-medium">송장번호</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{data.transNo}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    window.open(
                      `/api/onewms/delivery/invoice/${data.transNo}`,
                      '_blank'
                    );
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* CS/보류 상태 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium">CS 상태</div>
              <div className="text-sm text-muted-foreground">{data.csStatus}</div>
            </div>
            <div>
              <div className="text-sm font-medium">보류 상태</div>
              <div className="text-sm text-muted-foreground">{data.holdStatus}</div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {data.errorMessage && (
            <div className="rounded-md bg-red-50 p-3">
              <div className="text-sm font-medium text-red-800">에러</div>
              <div className="text-sm text-red-700">{data.errorMessage}</div>
            </div>
          )}

          {/* 관리자 전용: 재전송 버튼 */}
          {canManage && (
            <Button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {resendMutation.isPending ? '재전송 중...' : 'ONEWMS 재전송'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default OnewmsInfo;
