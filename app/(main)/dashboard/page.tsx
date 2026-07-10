"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import dynamic from "next/dynamic";
const SalesChart = dynamic(
  () => import("@/components/dashboard/sales-chart").then((m) => m.SalesChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> }
);
import { RankingTable } from "@/components/dashboard/ranking-table";
import { RecommendedProductsCard } from "@/components/dashboard/recommended-products-card";
import { DrilldownModal } from "@/components/dashboard/drilldown-modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const userRole = (session?.user as any)?.role;
  const isSeller = userRole === "SELLER";
  const isSubMaster = userRole === "SUB_MASTER";
  const isMaster = userRole === "MASTER";

  // 역할별 KPI 레이블 (2026-07-10: 데이터 소스가 Sale → 승인 발주(Order) 기준으로 변경)
  const kpiLabels = isSeller
    ? { sales: "내 발주액", count: "내 발주 건수", avgPrice: "평균 발주액", margin: "내 마진" }
    : isSubMaster
      ? { sales: "센터 발주액", count: "센터 발주 건수", avgPrice: "평균 발주액", margin: "센터 마진" }
      : { sales: "총 발주액", count: "발주 건수", avgPrice: "평균 발주액", margin: "총 마진" };

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [onewmsStats, setOnewmsStats] = useState<OnewmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldownType, setDrilldownType] = useState<"sales" | "count" | "avgPrice" | "margin" | null>(null);

  // 날짜 범위 상태 (기본: 최근 30일)
  const defaultTo = new Date().toISOString().split("T")[0];
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    // 운영 UX 개선(2026-06-XX): 두 API 를 Promise.all 로 묶으면 가장 느린 응답까지
    //   전체 스켈레톤을 유지해야 함. 각각 독립 호출로 분리하여 먼저 오는 응답부터
    //   부분 렌더 (dashboard 카드 먼저, ONEWMS 카드는 나중에).
    // dashboard API — 필수 (실패 시 전체 에러)
    fetch(`/api/stats/dashboard?fromDate=${fromDate}&toDate=${toDate}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("통계 데이터 로딩 실패"))))
      .then((dashboardData) => {
        setStats(dashboardData.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch dashboard stats");
        setLoading(false);
      });

    // ONEWMS stats — 선택 (실패해도 dashboard 는 표시). MASTER 만 호출.
    if (isMaster) {
      fetch("/api/onewms/stats")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((onewmsData) => {
          if (onewmsData?.data) setOnewmsStats(onewmsData.data);
        })
        .catch(() => {
          // 부수 통계 실패는 무시 (주 통계 화면은 표시됨)
        });
    }
  }, [fromDate, toDate, isMaster]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleDateChange = (newFrom: string, newTo: string) => {
    setFromDate(newFrom);
    setToDate(newTo);
  };

  // 셀러 랭킹
  const filteredRanking = useMemo(() => {
    if (!stats) return [];
    return stats.sellerRanking;
  }, [stats]);

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
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">
          {isSeller ? "내 통계" : isSubMaster ? "센터 대시보드" : "통계 대시보드"}
        </h1>
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onDateChange={handleDateChange}
        />
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={kpiLabels.sales}
          value={`${stats.totalSales.toLocaleString()}원`}
          trend={stats.salesTrend}
          icon={<DollarSignIcon className="h-8 w-8" />}
          onClick={() => setDrilldownType("sales")}
        />
        <StatCard
          label={kpiLabels.count}
          value={`${stats.totalCount.toLocaleString()}건`}
          trend={stats.countTrend}
          icon={<ShoppingCartIcon className="h-8 w-8" />}
          onClick={() => setDrilldownType("count")}
        />
        <StatCard
          label={kpiLabels.avgPrice}
          value={`${stats.avgPrice.toLocaleString()}원`}
          icon={<TrendingUpIcon className="h-8 w-8" />}
          onClick={() => setDrilldownType("avgPrice")}
        />
        <StatCard
          label={kpiLabels.margin}
          value={`${stats.totalMargin.toLocaleString()}원`}
          icon={<PercentIcon className="h-8 w-8" />}
          onClick={() => setDrilldownType("margin")}
        />
      </div>

      {/* 매출 추이 차트 */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">일별 발주 추이 ({fromDate} ~ {toDate})</h2>
        {stats.dailySales.length > 0 ? (
          <SalesChart data={stats.dailySales} />
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            데이터가 없습니다
          </div>
        )}
      </Card>

      {/* 셀러: 추천 상품 / 관리자: 셀러 랭킹 */}
      {isSeller && userId ? (
        <RecommendedProductsCard sellerId={userId} />
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">셀러 랭킹 (Top 10)</h2>
          </div>
          <RankingTable data={filteredRanking} />
        </Card>
      )}

      {/* ONEWMS 연동 상태 (MASTER 본사 전용 - 기획서 v2 9페이지: ONEWMS는 본사 관리) */}
      {isMaster && onewmsStats && (
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

      {/* 드릴다운 모달 */}
      <DrilldownModal
        open={drilldownType !== null}
        onClose={() => setDrilldownType(null)}
        type={drilldownType}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}
