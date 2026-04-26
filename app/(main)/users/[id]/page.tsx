"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RoleBadge } from "@/components/users/role-badge";
import {
  ArrowLeft,
  Radio,
  TrendingUp,
  ShoppingCart,
  Users,
} from "lucide-react";

interface UserStats {
  user: {
    id: string;
    name: string;
    role: string;
    centerName: string | null;
    centerCode: string | null;
    adminName: string | null;
  };
  stats: {
    broadcastCount: number;
    salesCount: number;
    totalSales: number;
    orderCount: number;
    sellerCount: number;
  };
  recentBroadcasts: Array<{
    id: string;
    code: string;
    platform: string;
    status: string;
    scheduledAt: string;
    startedAt: string | null;
    endedAt: string | null;
  }>;
  recentOrders: Array<{
    id: string;
    orderNo: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  recentSales: Array<{
    id: string;
    saleNo: string;
    quantity: number;
    totalPrice: number;
    saleDate: string;
    product: { name: string };
  }>;
  managedSellers: Array<{
    id: string;
    name: string;
    phone: string | null;
    channels: string[];
    createdAt: string;
    _count: { broadcasts: number; sales: number; orders: number };
  }>;
}

// Full user info from /api/users/:id
interface UserDetail {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  adminId: string | null;
  channels: string[];
  avgSales: number | null;
  createdAt: string;
}

const platformLabels: Record<string, string> = {
  GRIP: "그립",
  CLME: "클릭메이트",
  YOUTUBE: "유튜브",
  TIKTOK: "틱톡",
  BAND: "밴드",
};

const statusLabels: Record<string, string> = {
  SCHEDULED: "예정",
  LIVE: "진행중",
  ENDED: "종료",
  CANCELED: "취소",
  PENDING: "대기",
  CONFIRMED: "확인",
  SHIPPED: "배송중",
  DELIVERED: "완료",
  CANCELLED: "취소",
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  LIVE: "bg-red-100 text-red-800",
  ENDED: "bg-grey-100 text-grey-800",
  CANCELED: "bg-grey-100 text-grey-500",
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-grey-100 text-grey-500",
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const userRole = (session?.user as any)?.role;
  const hasAccess = userRole === "MASTER" || userRole === "SUB_MASTER";

  useEffect(() => {
    if (hasAccess && id) {
      Promise.all([
        fetch(`/api/users/${id}`).then((r) => r.json()),
        fetch(`/api/users/${id}/stats`).then((r) => r.json()),
      ]).then(([userData, statsData]) => {
        if (userData.data) setUserDetail(userData.data);
        if (statsData.data) setStats(statsData.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [hasAccess, id]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-red-600">접근 권한이 없습니다.</div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-grey-500">로딩 중...</div>
      </div>
    );
  }

  if (!userDetail || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-grey-500">사용자를 찾을 수 없습니다.</div>
        </Card>
      </div>
    );
  }

  const s = stats.stats;
  const isAdmin = stats.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/users")}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        사용자 목록으로
      </Button>

      {/* User Info Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{userDetail.name}</h1>
              <RoleBadge role={userDetail.role} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-grey-500">이메일: </span>
                <span>{userDetail.email}</span>
              </div>
              <div>
                <span className="text-grey-500">전화번호: </span>
                <span>{userDetail.phone || "-"}</span>
              </div>
              <div>
                <span className="text-grey-500">소속 센터: </span>
                <span>
                  {stats.user.centerCode
                    ? `${stats.user.centerCode} ${stats.user.centerName}`
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-grey-500">
                  {isAdmin ? "역할" : "소속 관리자"}: </span>
                <span>{isAdmin ? "관리자" : stats.user.adminName || "-"}</span>
              </div>
              <div>
                <span className="text-grey-500">활동 채널: </span>
                <span>
                  {userDetail.channels?.length > 0
                    ? userDetail.channels.join(", ")
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-grey-500">가입일: </span>
                <span>
                  {new Date(userDetail.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <StatCard
            icon={<Radio className="h-5 w-5 text-blue-600" />}
            label="방송 횟수"
            value={`${s.broadcastCount}회`}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            label="총 매출"
            value={
              s.totalSales > 0 ? `${s.totalSales.toLocaleString()}원` : "-"
            }
          />
          <StatCard
            icon={<ShoppingCart className="h-5 w-5 text-orange-600" />}
            label="발주 건수"
            value={`${s.orderCount}건`}
          />
          {isAdmin && (
            <StatCard
              icon={<Users className="h-5 w-5 text-purple-600" />}
              label="관리 셀러"
              value={`${s.sellerCount}명`}
            />
          )}
        </div>
      </Card>

      {/* Detail Tabs */}
      <Tabs defaultValue="broadcasts">
        <TabsList>
          <TabsTrigger value="broadcasts" className="gap-1.5">
            <Radio className="h-4 w-4" />
            방송 이력
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            매출 현황
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            발주 내역
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="sellers" className="gap-1.5">
              <Users className="h-4 w-4" />
              관리 셀러
            </TabsTrigger>
          )}
        </TabsList>

        {/* 방송 이력 */}
        <TabsContent value="broadcasts">
          <Card className="p-6">
            {stats.recentBroadcasts.length === 0 ? (
              <p className="text-grey-500 text-center py-8">
                방송 이력이 없습니다
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-grey-200">
                  <thead>
                    <tr className="bg-grey-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        방송 코드
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        플랫폼
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        상태
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        예정일
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        시작
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        종료
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-200">
                    {stats.recentBroadcasts.map((b) => (
                      <tr key={b.id} className="hover:bg-grey-50">
                        <td className="px-4 py-3 text-sm font-mono">
                          {b.code}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {platformLabels[b.platform] || b.platform}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-grey-600">
                          {formatDateTime(b.scheduledAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-grey-600">
                          {b.startedAt ? formatDateTime(b.startedAt) : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-grey-600">
                          {b.endedAt ? formatDateTime(b.endedAt) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* 매출 현황 */}
        <TabsContent value="sales">
          <Card className="p-6">
            {stats.recentSales.length === 0 ? (
              <p className="text-grey-500 text-center py-8">
                매출 내역이 없습니다
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-grey-200">
                  <thead>
                    <tr className="bg-grey-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        판매번호
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        상품
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                        수량
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                        금액
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        판매일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-200">
                    {stats.recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-grey-50">
                        <td className="px-4 py-3 text-sm font-mono">
                          {sale.saleNo}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {sale.product.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {sale.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {sale.totalPrice.toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-sm text-grey-600">
                          {formatDate(sale.saleDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.salesCount > 10 && (
                  <p className="text-xs text-grey-400 mt-3 text-center">
                    최근 10건 표시 (전체 {s.salesCount}건)
                  </p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* 발주 내역 */}
        <TabsContent value="orders">
          <Card className="p-6">
            {stats.recentOrders.length === 0 ? (
              <p className="text-grey-500 text-center py-8">
                발주 내역이 없습니다
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-grey-200">
                  <thead>
                    <tr className="bg-grey-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        주문번호
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        상태
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                        금액
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                        주문일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-200">
                    {stats.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-grey-50 cursor-pointer"
                        onClick={() => router.push(`/orders/${order.id}`)}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-blue-600">
                          {order.orderNo}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {order.totalAmount.toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-sm text-grey-600">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.orderCount > 10 && (
                  <p className="text-xs text-grey-400 mt-3 text-center">
                    최근 10건 표시 (전체 {s.orderCount}건)
                  </p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* 관리 셀러 (ADMIN만) */}
        {isAdmin && (
          <TabsContent value="sellers">
            <Card className="p-6">
              {stats.managedSellers.length === 0 ? (
                <p className="text-grey-500 text-center py-8">
                  관리 중인 셀러가 없습니다
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-grey-200">
                    <thead>
                      <tr className="bg-grey-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                          이름
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                          전화번호
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                          채널
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                          방송
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                          매출 건수
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                          발주 건수
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                          가입일
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-200">
                      {stats.managedSellers.map((seller) => (
                        <tr
                          key={seller.id}
                          className="hover:bg-grey-50 cursor-pointer"
                          onClick={() => router.push(`/users/${seller.id}`)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">
                            {seller.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-grey-600">
                            {seller.phone || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-grey-600">
                            {seller.channels?.length > 0
                              ? seller.channels.join(", ")
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {seller._count.broadcasts}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {seller._count.sales}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {seller._count.orders}
                          </td>
                          <td className="px-4 py-3 text-sm text-grey-600">
                            {formatDate(seller.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-grey-50 rounded-lg">
      {icon}
      <div>
        <p className="text-xs text-grey-500">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
        statusColors[status] || "bg-grey-100 text-grey-800"
      }`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR");
}
