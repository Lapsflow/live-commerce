"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

interface SyncMonitorData {
  summary: {
    lastSyncTime: string | null;
    lastSyncDuration: number | null;
    matchRate: number | null;
    lastHealthcheckTime: string | null;
    activeConflicts: number;
    failedOrders: number;
  };
  cronHistory: Array<{
    id: string;
    createdAt: string;
    description: string;
    metadata: any;
  }>;
  conflictTrend: Array<{ date: string; count: number }>;
  conflicts: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    onewmsQty: number;
    localQty: number;
    difference: number;
    syncedAt: string;
  }>;
}

export default function SyncMonitorPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const userRole = (session?.user as any)?.role;

  // Redirect non-MASTER
  if (session && userRole !== "MASTER") {
    router.push("/dashboard");
    return null;
  }

  // Fetch monitoring data
  const { data, isLoading, refetch } = useQuery<SyncMonitorData>({
    queryKey: ["sync-monitor"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sync-monitor");
      if (!res.ok) throw new Error("Failed to fetch monitoring data");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: autoRefresh ? 60_000 : false,
  });

  // Healthcheck mutation
  const healthcheckMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/sync-monitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ action: "healthcheck" }),
      });
      if (!res.ok) throw new Error("Healthcheck failed");
      return res.json();
    },
    onSuccess: (result) => {
      const rate = result.data?.matchRate ?? 0;
      toast.success(`일치율 검증 완료: ${rate}%`);
      queryClient.invalidateQueries({ queryKey: ["sync-monitor"] });
    },
    onError: () => {
      toast.error("일치율 검증에 실패했습니다");
    },
  });

  // Conflict resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      resolution,
    }: {
      id: string;
      resolution: "onewms" | "local" | "ignore";
    }) => {
      const res = await fetch(`/api/onewms/stock/conflicts/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) throw new Error("Failed to resolve conflict");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-monitor"] });
      setResolvingId(null);
      toast.success("충돌이 해결되었습니다");
    },
    onError: () => {
      toast.error("충돌 해결에 실패했습니다");
      setResolvingId(null);
    },
  });

  const summary = data?.summary;

  // Format time ago
  const formatTimeAgo = (iso: string | null) => {
    if (!iso) return "없음";
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });
  };

  // Match rate color
  const getMatchRateColor = (rate: number | null) => {
    if (rate === null) return undefined;
    if (rate >= 95) return "text-green-600";
    if (rate >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  // Chart date formatting
  const formattedTrend = (data?.conflictTrend || []).map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    }),
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">동기화 모니터</h1>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-[250px] w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">동기화 모니터</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              size="sm"
            />
            <span className="text-sm text-muted-foreground">
              자동 새로고침 (60초)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          <Button
            size="sm"
            onClick={() => healthcheckMutation.mutate()}
            disabled={healthcheckMutation.isPending}
          >
            {healthcheckMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                검증 중...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                일치율 검증
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="마지막 동기화"
          value={formatTimeAgo(summary?.lastSyncTime ?? null)}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="일치율"
          value={
            summary?.matchRate !== null && summary?.matchRate !== undefined
              ? `${summary.matchRate}%`
              : "미검증"
          }
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          label="활성 충돌"
          value={String(summary?.activeConflicts ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="실패 주문"
          value={String(summary?.failedOrders ?? 0)}
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      {/* Match rate detail */}
      {summary?.lastHealthcheckTime && (
        <p className="text-xs text-muted-foreground -mt-4">
          <span className={getMatchRateColor(summary.matchRate)}>
            일치율 {summary.matchRate}%
          </span>
          {" · "}
          마지막 검증: {formatTimeAgo(summary.lastHealthcheckTime)}
        </p>
      )}

      {/* Conflict Trend Chart */}
      {formattedTrend.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">충돌 추이 (7일)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={formattedTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted"
              />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                allowDecimals={false}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value) => [`${value}건`, "충돌"]}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--destructive))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cron History Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Cron 실행 이력 (최근 10회)
        </h2>
        {(data?.cronHistory?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            실행 이력이 없습니다
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    시간
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    소요시간
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    동기화
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    충돌
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    에러
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.cronHistory.map((log) => {
                  const meta = log.metadata as any;
                  const stock = meta?.stock;
                  return (
                    <tr
                      key={log.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatTimeAgo(log.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {meta?.durationMs
                          ? `${(meta.durationMs / 1000).toFixed(1)}초`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {stock
                          ? `${stock.synced}/${stock.totalProducts}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {stock?.conflicts !== undefined ? (
                          <span
                            className={
                              stock.conflicts > 0
                                ? "text-yellow-600 font-medium"
                                : ""
                            }
                          >
                            {stock.conflicts}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {stock?.errors !== undefined ? (
                          <span
                            className={
                              stock.errors > 0
                                ? "text-red-600 font-medium"
                                : ""
                            }
                          >
                            {stock.errors}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Active Conflicts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">활성 충돌</h2>
          {(data?.conflicts?.length ?? 0) > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              {data!.conflicts.length}건
            </span>
          )}
        </div>

        {(data?.conflicts?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            재고 충돌이 없습니다
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    상품
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    ONEWMS
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    플랫폼
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    차이
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    발견
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.conflicts.map((c: any) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.productCode}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {c.onewmsQty}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {c.localQty}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-medium ${
                          c.difference > 0
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}
                      >
                        {c.difference > 0 ? "+" : ""}
                        {c.difference}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(c.syncedAt)}
                    </td>
                    <td className="px-3 py-2">
                      {resolvingId === c.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              resolveMutation.mutate({
                                id: c.id,
                                resolution: "onewms",
                              })
                            }
                            disabled={resolveMutation.isPending}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                          >
                            ONEWMS
                          </button>
                          <button
                            onClick={() =>
                              resolveMutation.mutate({
                                id: c.id,
                                resolution: "local",
                              })
                            }
                            disabled={resolveMutation.isPending}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50"
                          >
                            플랫폼
                          </button>
                          <button
                            onClick={() =>
                              resolveMutation.mutate({
                                id: c.id,
                                resolution: "ignore",
                              })
                            }
                            disabled={resolveMutation.isPending}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50"
                          >
                            무시
                          </button>
                          <button
                            onClick={() => setResolvingId(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolvingId(c.id)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                        >
                          해결
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
