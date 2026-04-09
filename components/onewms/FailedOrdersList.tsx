/**
 * ONEWMS Failed Orders List
 * Display failed orders with retry and manual intervention options
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function FailedOrdersList() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  // Fetch failed orders
  const { data: failedOrders, isLoading } = useQuery({
    queryKey: ['failed-orders'],
    queryFn: async () => {
      const res = await fetch('/api/onewms/orders?status=failed');
      if (!res.ok) {
        // Fallback: fetch all orders and filter
        const allRes = await fetch('/api/orders?limit=100');
        if (!allRes.ok) return [];
        const allJson = await allRes.json();

        // Get failed mappings
        const mappingsRes = await fetch('/api/onewms/mappings?status=failed');
        const mappingsData = mappingsRes.ok ? await mappingsRes.json() : [];

        return mappingsData.data || [];
      }
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Retry single order mutation
  const retryMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch('/api/onewms/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error('Retry failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failed-orders'] });
      queryClient.invalidateQueries({ queryKey: ['onewms-stats'] });
      setSelectedOrder(null);
      alert('주문 재전송이 완료되었습니다');
    },
    onError: (error: any) => {
      alert(`재전송 실패: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">실패 주문</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const orders = Array.isArray(failedOrders) ? failedOrders : [];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">실패 주문</h2>
        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
          {orders.length}건
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <p>실패한 주문이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <div
              key={order.id}
              className="border border-red-200 rounded-lg p-4 bg-red-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">
                      {order.order?.orderNo || order.onewmsOrderNo}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'manual_intervention'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {order.status === 'manual_intervention'
                        ? '수동 처리 필요'
                        : `실패 (${order.retryCount}/3)`}
                    </span>
                  </div>

                  {order.errorMessage && (
                    <div className="text-sm text-red-700 mb-2">
                      ❌ {order.errorMessage}
                    </div>
                  )}

                  <div className="text-xs text-gray-600">
                    {order.lastSyncAt && (
                      <span>
                        마지막 시도:{' '}
                        {new Date(order.lastSyncAt).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {order.status !== 'manual_intervention' && (
                    <button
                      onClick={() => retryMutation.mutate(order.orderId)}
                      disabled={retryMutation.isPending}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                    >
                      재시도
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedOrder(order.id)}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    상세
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">주문 상세</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {orders
                .filter((o: any) => o.id === selectedOrder)
                .map((order: any) => (
                  <div key={order.id} className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">주문번호</span>
                      <div className="font-medium">
                        {order.order?.orderNo || order.onewmsOrderNo}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">상태</span>
                      <div className="font-medium">{order.status}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">재시도 횟수</span>
                      <div className="font-medium">
                        {order.retryCount} / 3
                      </div>
                    </div>
                    {order.errorMessage && (
                      <div>
                        <span className="text-sm text-gray-600">
                          에러 메시지
                        </span>
                        <div className="font-medium text-red-600">
                          {order.errorMessage}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-gray-600">생성 시각</span>
                      <div className="font-medium">
                        {new Date(order.createdAt).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    {order.lastSyncAt && (
                      <div>
                        <span className="text-sm text-gray-600">
                          마지막 동기화 시도
                        </span>
                        <div className="font-medium">
                          {new Date(order.lastSyncAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
