/**
 * ONEWMS Stock Conflicts List
 *
 * Hotfix 2026-05-12:
 *   - 페이지네이션 추가 (13,000+ 운영 데이터에서 DOM OOM crash 방지)
 *   - API 응답 구조 정정: data.conflicts (배열) 사용
 *   - 페이지당 50건 + Prev/Next 네비게이션
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PAGE_SIZE = 50;

interface StockConflict {
  id: string;
  productName: string;
  productCode: string;
  onewmsQty: number;
  localQty: number;
  difference: number;
  syncedAt: string;
}

interface ConflictsResponse {
  conflicts: StockConflict[];
  count: number;
  returned: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function StockConflictsList() {
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [page, setPage] = useState(0); // 0-based

  const offset = page * PAGE_SIZE;

  // Fetch conflicts (페이지네이션)
  // placeholderData: 다음 페이지 로딩 중에도 이전 페이지 데이터 유지 → 깜빡임 없음
  const { data, isLoading, isFetching, error } = useQuery<ConflictsResponse>({
    queryKey: ['stock-conflicts', page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/onewms/stock/conflicts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch conflicts');
      const json = await res.json();
      // API 응답 구조: { data: { conflicts: [...], count, hasMore, ... } }
      return json.data ?? { conflicts: [], count: 0, returned: 0, limit: PAGE_SIZE, offset: 0, hasMore: false };
    },
    placeholderData: (prev) => prev, // 이전 페이지 데이터 유지 (페이지 전환 깜빡임 방지)
    refetchInterval: 60000,
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
    onError: (error: Error) => {
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
            <div key={i} className="h-16 bg-grey-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">재고 충돌</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          충돌 목록을 불러오지 못했습니다: {error.message}
        </div>
      </div>
    );
  }

  const conflicts = data?.conflicts ?? [];
  const totalCount = data?.count ?? 0;
  const hasMore = data?.hasMore ?? false;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">재고 충돌</h2>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
            전체 {totalCount.toLocaleString()}건
          </span>
        </div>
        {totalCount > PAGE_SIZE && (
          <div className="text-sm text-grey-600">
            {offset + 1} - {offset + conflicts.length} / {totalCount.toLocaleString()}
            <span className="ml-2 text-grey-400">(페이지 {page + 1} / {totalPages})</span>
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-8 text-grey-500">
          <div className="text-4xl mb-2">✅</div>
          <p>재고 충돌이 없습니다</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-grey-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-grey-600">
                    상품명
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-grey-600">
                    ONEWMS
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-grey-600">
                    플랫폼
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-grey-600">
                    차이
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-grey-600">
                    발견 시각
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-grey-600">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conflicts.map((conflict) => (
                  <tr key={conflict.id} className="hover:bg-grey-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{conflict.productName}</div>
                      <div className="text-grey-500 text-xs">
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
                    <td className="px-4 py-3 text-sm text-grey-600">
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
                            className="px-2 py-1 bg-grey-500 text-white rounded text-xs hover:bg-grey-600 disabled:opacity-50"
                          >
                            무시
                          </button>
                          <button
                            onClick={() => setResolvingId(null)}
                            className="px-2 py-1 bg-grey-200 text-grey-700 rounded text-xs hover:bg-grey-300"
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

          {/* 페이지네이션 컨트롤 */}
          {totalCount > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="px-4 py-2 bg-grey-100 text-grey-700 rounded hover:bg-grey-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                ← 이전
              </button>
              <div className="text-sm text-grey-600 flex items-center gap-2">
                <span>
                  페이지 <span className="font-semibold">{page + 1}</span> / {totalPages}
                </span>
                {isFetching && (
                  <span className="text-xs text-blue-500">⟳ 로딩 중</span>
                )}
              </div>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore || isFetching}
                className="px-4 py-2 bg-grey-100 text-grey-700 rounded hover:bg-grey-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
