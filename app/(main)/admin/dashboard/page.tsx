'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { OnewmsStatusWidget } from './components/onewms-status-widget';

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 권한 체크: MASTER, SUB_MASTER, ADMIN만 접근 가능
  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    const allowedRoles = ['MASTER', 'SUB_MASTER', 'ADMIN'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grey-900" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          실시간 통계 및 시스템 상태를 확인하세요
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* ONEWMS 상태 위젯 */}
        <div className="col-span-full lg:col-span-2">
          <OnewmsStatusWidget />
        </div>

        {/* 추가 위젯들은 여기에 배치 */}
        {/* 예: 주문 통계, 재고 통계, 셀러 통계 등 */}
      </div>
    </div>
  );
}
