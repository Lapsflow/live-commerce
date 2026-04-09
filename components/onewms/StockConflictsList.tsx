/**
 * ONEWMS Stock Conflicts List
 * Display and resolve stock conflicts
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function StockConflictsList() {
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Fetch conflicts
  const { data, isLoading } = useQuery({
    queryKey: ['stock-conflicts'],
    queryFn: async () => {
      const res = await fetch('/api/onewms/stock/conflicts');
      if (!res.ok) throw new Error('Failed to fetch conflicts');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Resolve conflict mutation
  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      resolution,
    }: {
      id: string;
      resolution: 'onewms' | 'local' | 'ignore';
    }) => {
      const res = await fetch(`/api/onewms/stock/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) throw new Error('Failed to resolve conflict');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['onewms-stats'] });
      setResolvingId(null);
      alert('충돌이 해결되었습니다');
    },
    onError: (error: any) => {
      alert(`충돌 해결 실패: ${error.message}`);
      setResolvingId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">재고 충돌</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const conflicts = data || [];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">재고 충돌</h2>
        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {conflicts.length}건
        </span>
      </div>

      {conflicts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <p>재고 충돌이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  상품명
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  ONEWMS
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  플랫폼
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  차이
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  발견 시각
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {conflicts.map((conflict: any) => (
                <tr key={conflict.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{conflict.productName}</div>
                    <div className="text-gray-500 text-xs">
                      {conflict.productCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {conflict.onewmsQty}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {conflict.localQty}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`font-medium ${
                        conflict.difference > 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                      }`}
                    >
                      {conflict.difference > 0 ? '+' : ''}
                      {conflict.difference}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(conflict.syncedAt).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {resolvingId === conflict.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            resolveMutation.mutate({
                              id: conflict.id,
                              resolution: 'onewms',
                            })
                          }
                          disabled={resolveMutation.isPending}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                        >
                          ONEWMS
                        </button>
                        <button
                          onClick={() =>
                            resolveMutation.mutate({
                              id: conflict.id,
                              resolution: 'local',
                            })
                          }
                          disabled={resolveMutation.isPending}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50"
                        >
                          플랫폼
                        </button>
                        <button
                          onClick={() =>
                            resolveMutation.mutate({
                              id: conflict.id,
                              resolution: 'ignore',
                            })
                          }
                          disabled={resolveMutation.isPending}
                          className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50"
                        >
                          무시
                        </button>
                        <button
                          onClick={() => setResolvingId(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setResolvingId(conflict.id)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                      >
                        해결
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
