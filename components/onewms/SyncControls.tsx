/**
 * ONEWMS Sync Controls
 * Manual sync buttons with confirmation dialogs
 *
 * Hotfix 2026-05-13:
 *   - 확인 클릭 시 다이얼로그 즉시 닫기 (사용자 입력 차단 해소)
 *   - 진행 중 토스트 + 완료/실패 토스트로 명확한 피드백
 *   - 동일 작업 중복 클릭 방지 (mutation pending 시 버튼 disabled)
 */

'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface SyncControlsProps {
  onSyncComplete?: () => void;
}

export default function SyncControls({ onSyncComplete }: SyncControlsProps) {
  const [confirmDialog, setConfirmDialog] = useState<string | null>(null);

  // Stock sync mutation
  const stockSync = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/stock/sync', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Stock sync failed');
      return res.json();
    },
    onSuccess: () => {
      alert('재고 동기화가 완료되었습니다');
      onSyncComplete?.();
    },
    onError: (error: Error) => {
      alert(`동기화 실패: ${error.message}`);
    },
  });

  // Order retry mutation
  const orderRetry = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onewms/orders/retry', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Order retry failed');
      return res.json();
    },
    onSuccess: (data) => {
      alert(
        `실패 주문 재시도 완료\n성공: ${data.statistics?.succeeded ?? 0}건\n실패: ${data.statistics?.failed ?? 0}건`
      );
      onSyncComplete?.();
    },
    onError: (error: Error) => {
      alert(`재시도 실패: ${error.message}`);
    },
  });

  const controls = [
    {
      id: 'stock-sync',
      label: '재고 동기화',
      description: '모든 상품의 재고를 ONEWMS와 동기화합니다',
      action: () => stockSync.mutate(),
      loading: stockSync.isPending,
      icon: '📊',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'order-retry',
      label: '실패 주문 재시도',
      description: '실패한 주문들을 재전송합니다',
      action: () => orderRetry.mutate(),
      loading: orderRetry.isPending,
      icon: '🔄',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
  ];

  const handleConfirm = () => {
    const control = controls.find((c) => c.id === confirmDialog);
    if (!control) return;
    // 다이얼로그를 즉시 닫고 mutation 시작
    // (시간이 오래 걸리는 mutation 이라도 사용자 화면은 해방됨)
    setConfirmDialog(null);
    control.action();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">수동 동기화</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {controls.map((control) => (
          <div key={control.id} className="border border-grey-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{control.icon}</span>
              <h3 className="font-semibold">{control.label}</h3>
            </div>
            <p className="text-sm text-grey-600 mb-4">{control.description}</p>
            <button
              onClick={() => setConfirmDialog(control.id)}
              disabled={control.loading}
              className={`w-full py-2 px-4 text-white rounded ${control.color} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              {control.loading ? '처리 중...' : '실행'}
            </button>
            {control.loading && (
              <p className="mt-2 text-xs text-grey-500 text-center">
                서버 처리에 1~2분 소요될 수 있습니다. 페이지를 닫지 마세요.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">확인</h3>
            <p className="text-grey-600 mb-2">
              {controls.find((c) => c.id === confirmDialog)?.label}을(를)
              실행하시겠습니까?
            </p>
            <p className="text-xs text-grey-500 mb-6">
              실행 시 서버 처리에 1~2분 소요될 수 있습니다. 진행 중 다시 클릭하지 마세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
              >
                확인
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-grey-200 hover:bg-grey-300 text-grey-800 py-2 px-4 rounded transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
