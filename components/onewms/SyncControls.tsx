/**
 * ONEWMS Sync Controls
 * Manual sync buttons with confirmation dialogs
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
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      alert(`동기화 실패: ${error.message}`);
      setConfirmDialog(null);
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
        `실패 주문 재시도 완료\n성공: ${data.statistics.succeeded}건\n실패: ${data.statistics.failed}건`
      );
      onSyncComplete?.();
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      alert(`재시도 실패: ${error.message}`);
      setConfirmDialog(null);
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

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">수동 동기화</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {controls.map((control) => (
          <div key={control.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{control.icon}</span>
              <h3 className="font-semibold">{control.label}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{control.description}</p>
            <button
              onClick={() => setConfirmDialog(control.id)}
              disabled={control.loading}
              className={`w-full py-2 px-4 text-white rounded ${control.color} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              {control.loading ? '처리 중...' : '실행'}
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2">확인</h3>
            <p className="text-gray-600 mb-6">
              {controls.find((c) => c.id === confirmDialog)?.label}을(를)
              실행하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const control = controls.find((c) => c.id === confirmDialog);
                  control?.action();
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
              >
                확인
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded transition-colors"
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
