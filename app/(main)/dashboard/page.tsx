"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { RankingTable } from "@/components/dashboard/ranking-table";
import {
  TrendingUpIcon,
  ShoppingCartIcon,
  DollarSignIcon,
  PercentIcon,
  PackageIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  totalSales: number;
  totalCount: number;
  avgPrice: number;
  totalMargin: number;
  salesTrend?: number;
  countTrend?: number;
  dailySales: Array<{ date: string; totalSales: number; count: number }>;
  sellerRanking: Array<{
    sellerId: string;
    sellerName: string;
    totalSales: number;
    count: number;
  }>;
}

interface OnewmsStats {
  orders: {
    failed: number;
  };
  stock: {
    conflicts: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [onewmsStats, setOnewmsStats] = useState<OnewmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/dashboard").then((res) => res.ok ? res.json() : Promise.reject()),
      fetch("/api/onewms/stats").then((res) => res.ok ? res.json() : Promise.reject()).catch(() => null)
    ])
      .then(([dashboardData, onewmsData]) => {
        setStats(dashboardData.data);
        if (onewmsData?.data) {
          setOnewmsStats(onewmsData.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch dashboard stats");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">
            {error || "데이터를 불러올 수 없습니다"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">통계 대시보드</h1>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="총 매출"
          value={`${stats.totalSales.toLocaleString()}원`}
          trend={stats.salesTrend}
          icon={<DollarSignIcon className="h-8 w-8" />}
        />
        <StatCard
          label="판매 건수"
          value={`${stats.totalCount.toLocaleString()}건`}
          trend={stats.countTrend}
          icon={<ShoppingCartIcon className="h-8 w-8" />}
        />
        <StatCard
          label="평균 단가"
          value={`${stats.avgPrice.toLocaleString()}원`}
          icon={<TrendingUpIcon className="h-8 w-8" />}
        />
        <StatCard
          label="총 마진"
          value={`${stats.totalMargin.toLocaleString()}원`}
          icon={<PercentIcon className="h-8 w-8" />}
        />
      </div>

      {/* 매출 추이 차트 */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">일별 매출 추이 (최근 30일)</h2>
        {stats.dailySales.length > 0 ? (
          <SalesChart data={stats.dailySales} />
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            데이터가 없습니다
          </div>
        )}
      </Card>

      {/* 셀러 랭킹 */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">셀러 랭킹 (Top 10)</h2>
        <RankingTable data={stats.sellerRanking} />
      </Card>

      {/* ONEWMS 연동 상태 */}
      {onewmsStats && (
        <Card className="p-6 border-blue-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PackageIcon className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-900">ONEWMS 연동 상태</h2>
            </div>
            <Link href="/dashboard/onewms">
              <Button variant="outline" size="sm">
                전체 보기
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
              <AlertTriangleIcon className={`h-8 w-8 ${onewmsStats.orders.failed > 0 ? 'text-red-500' : 'text-grey-300'}`} />
              <div>
                <p className="text-sm text-grey-600">실패 주문</p>
                <p className="text-2xl font-bold text-grey-900">{onewmsStats.orders.failed}건</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
              <AlertTriangleIcon className={`h-8 w-8 ${onewmsStats.stock.conflicts > 0 ? 'text-yellow-500' : 'text-grey-300'}`} />
              <div>
                <p className="text-sm text-grey-600">재고 충돌</p>
                <p className="text-2xl font-bold text-grey-900">{onewmsStats.stock.conflicts}건</p>
              </div>
            </div>
          </div>

          {(onewmsStats.orders.failed > 0 || onewmsStats.stock.conflicts > 0) && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ 주의가 필요한 항목이 있습니다. ONEWMS 대시보드에서 확인하세요.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
