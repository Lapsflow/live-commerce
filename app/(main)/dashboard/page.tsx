"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { RankingTable } from "@/components/dashboard/ranking-table";
import {
  TrendingUpIcon,
  ShoppingCartIcon,
  DollarSignIcon,
  PercentIcon,
} from "lucide-react";

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard stats");
        return res.json();
      })
      .then((data) => {
        setStats(data.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">로딩 중...</p>
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
    </div>
  );
}
