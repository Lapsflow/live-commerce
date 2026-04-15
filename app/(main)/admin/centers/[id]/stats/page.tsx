"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CenterStats {
  center: {
    id: string;
    code: string;
    name: string;
    regionName: string;
  };
  stats: {
    totalUsers: number;
    totalProducts: number;
    totalOrders: number;
    totalBroadcasts: number;
    usersByRole: {
      ADMIN: number;
      SELLER: number;
    };
    topProducts: Array<{
      productId: string;
      productName: string;
      stock: number;
    }>;
    recentOrders: Array<{
      id: string;
      orderNo: string;
      totalAmount: number;
      createdAt: string;
    }>;
  };
}

export default function CenterStatsPage() {
  const params = useParams();
  const router = useRouter();
  const centerId = params.id as string;

  const [stats, setStats] = useState<CenterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [centerId]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/centers/${centerId}/stats`);
      const data = await res.json();

      if (res.ok && data.success) {
        setStats(data.data);
      } else {
        setError(data.error?.message || "통계를 불러올 수 없습니다");
      }
    } catch (err) {
      console.error("Error loading stats:", err);
      setError("통계를 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-6xl">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-red-600">
            {error || "통계를 찾을 수 없습니다"}
          </div>
        </Card>
      </div>
    );
  }

  const { center, stats: centerStats } = stats;

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/admin/centers/${centerId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{center.name} 통계</h1>
          <p className="text-muted-foreground">
            {center.regionName} • {center.code}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">소속 사용자</p>
              <p className="text-3xl font-bold">{centerStats.totalUsers}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  관리자: {centerStats.usersByRole.ADMIN}
                </span>
                <span className="text-xs text-muted-foreground">
                  셀러: {centerStats.usersByRole.SELLER}
                </span>
              </div>
            </div>
            <Users className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">센터 상품</p>
              <p className="text-3xl font-bold">{centerStats.totalProducts}</p>
              <p className="text-xs text-muted-foreground mt-2">
                재고 중인 상품
              </p>
            </div>
            <Package className="h-10 w-10 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">총 주문</p>
              <p className="text-3xl font-bold">{centerStats.totalOrders}</p>
              <p className="text-xs text-muted-foreground mt-2">
                처리된 주문 건수
              </p>
            </div>
            <ShoppingCart className="h-10 w-10 text-orange-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">방송 횟수</p>
              <p className="text-3xl font-bold">{centerStats.totalBroadcasts}</p>
              <p className="text-xs text-muted-foreground mt-2">
                진행된 방송
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-purple-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">상위 재고 상품</h3>
          {centerStats.topProducts.length > 0 ? (
            <div className="space-y-3">
              {centerStats.topProducts.map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-3 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-muted-foreground">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{product.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        재고: {product.stock}개
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              재고 중인 상품이 없습니다
            </p>
          )}
        </Card>

        {/* Recent Orders */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">최근 주문</h3>
          {centerStats.recentOrders.length > 0 ? (
            <div className="space-y-3">
              {centerStats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-md"
                >
                  <div>
                    <p className="font-medium font-mono">{order.orderNo}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {order.totalAmount.toLocaleString()}원
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              주문 내역이 없습니다
            </p>
          )}
        </Card>
      </div>

      {/* Performance Summary */}
      <Card className="p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">성과 요약</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              사용자당 평균 주문
            </p>
            <p className="text-2xl font-bold">
              {centerStats.totalUsers > 0
                ? (centerStats.totalOrders / centerStats.totalUsers).toFixed(1)
                : "0"}
              건
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              상품당 평균 재고
            </p>
            <p className="text-2xl font-bold">
              {centerStats.totalProducts > 0 &&
              centerStats.topProducts.length > 0
                ? (
                    centerStats.topProducts.reduce((sum, p) => sum + p.stock, 0) /
                    centerStats.topProducts.length
                  ).toFixed(0)
                : "0"}
              개
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">활성도</p>
            <p className="text-2xl font-bold">
              {centerStats.totalBroadcasts > 0 &&
              centerStats.totalOrders > 0
                ? (
                    (centerStats.totalOrders / centerStats.totalBroadcasts) *
                    100
                  ).toFixed(0)
                : "0"}
              %
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
