/**
 * ONEWMS Status Widget
 * Display real-time sync statistics and health metrics
 */

'use client';

interface OnewmsStatusWidgetProps {
  stats: any;
  isLoading: boolean;
}

export default function OnewmsStatusWidget({
  stats,
  isLoading,
}: OnewmsStatusWidgetProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        통계 데이터를 불러올 수 없습니다
      </div>
    );
  }

  const { orders, stock } = stats;

  const metrics = [
    {
      label: '총 동기화 주문',
      value: orders.total,
      color: 'bg-blue-500',
      icon: '📦',
    },
    {
      label: '동기화 성공률',
      value: `${orders.successRate}%`,
      color: 'bg-green-500',
      icon: '✅',
    },
    {
      label: '실패 주문',
      value: orders.failed,
      color: orders.failed > 0 ? 'bg-red-500' : 'bg-gray-300',
      icon: '❌',
    },
    {
      label: '재고 충돌',
      value: stock.conflicts,
      color: stock.conflicts > 0 ? 'bg-yellow-500' : 'bg-gray-300',
      icon: '⚠️',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{metric.label}</span>
            <span className="text-2xl">{metric.icon}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{metric.value}</div>
          <div className={`mt-3 h-1 ${metric.color} rounded`}></div>
        </div>
      ))}

      {/* Last Sync Time */}
      {stock.lastSync && (
        <div className="col-span-full bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">마지막 재고 동기화</span>
              <p className="text-xs text-gray-500 mt-1">
                ⏰ 자동 동기화: 5분마다 실행
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-gray-900 block">
                {getRelativeTime(stock.lastSync)}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(stock.lastSync).toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for relative time
function getRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 5) return `${diffMins}분 전`;
  if (diffMins < 60) return `${diffMins}분 전`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}
    </div>
  );
}
