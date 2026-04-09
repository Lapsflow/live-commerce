/**
 * ONEWMS Integration Dashboard
 * Monitor and control ONEWMS synchronization
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import OnewmsStatusWidget from '@/components/onewms/OnewmsStatusWidget';
import SyncControls from '@/components/onewms/SyncControls';
import StockConflictsList from '@/components/onewms/StockConflictsList';
import FailedOrdersList from '@/components/onewms/FailedOrdersList';

export default function OnewmsDashboardPage() {
  // Fetch dashboard stats
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['onewms-stats'],
    queryFn: async () => {
      const res = await fetch('/api/onewms/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ONEWMS 통합 관리</h1>
        <p className="text-gray-600">
          주문, 재고, 배송 상태를 실시간으로 모니터링하고 관리합니다
        </p>
      </div>

      {/* Status Widget */}
      <div className="mb-8">
        <OnewmsStatusWidget stats={stats} isLoading={isLoading} />
      </div>

      {/* Sync Controls */}
      <div className="mb-8">
        <SyncControls onSyncComplete={() => refetch()} />
      </div>

      {/* Stock Conflicts */}
      <div className="mb-8">
        <StockConflictsList />
      </div>

      {/* Failed Orders */}
      <div className="mb-8">
        <FailedOrdersList />
      </div>
    </div>
  );
}
