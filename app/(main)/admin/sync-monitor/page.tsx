"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
import dynamic from "next/dynamic";

const ConflictTrendChart = dynamic(
  () =>
    import("recharts").then((mod) => {
      const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = mod;
      return {
        default: ({ data }: { data: Array<{ date: string; count: number }> }) => (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value) => [`${value}건`, "충돌"]}
              />
              <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ),
      };
    }),
  { ssr: false, loading: () => <div className="h-[250px] animate-pulse bg-muted rounded-lg" /> }
);
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// 성능 개선 (2026-07-10, docs/PERFORMANCE_DIAGNOSIS_20260710.md 옵션 A):
//   기존: 단일 /api/admin/sync-monitor 가 전체 충돌 목록 포함 응답 →
//   가장 느린 쿼리까지 화면 전체가 스켈레톤 → 랜딩 실패 수준.
//   변경: summary / conflicts / trend 3개 독립 fetch —
//   먼저 오는 응답부터 부분 렌더 (dashboard commit aa67945 동일 패턴).
//   conflicts 는 20건씩 커서 페이지네이션 + "더보기" (CLAUDE.md 학습 #10).
// ─────────────────────────────────────────────────────────────

interface SummaryData {
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
    description: string | null;
    metadata: unknown;
  }>;
}

interface ConflictItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  onewmsQty: number;
  localQty: number;
  difference: number;
  syncedAt: string;
}

interface ConflictsPage {
  items: ConflictItem[];
  nextCursor: string | null;
}

const CONFLICTS_PAGE_SIZE = 20;

export default function SyncMonitorPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isMaster = userRole === "MASTER";

  // Redirect non-MASTER — 렌더 중 조건부 return 은 hooks 순서를 깨므로 effect 로 처리
  useEffect(() => {
    if (session && !isMaster) {
      router.push("/dashboard");
    }
  }, [session, isMaster, router]);

  // ── 1. 요약 카드 + Cron 이력 (가볍고 빠름 — 먼저 렌더)
  const summaryQuery = useQuery<SummaryData>({
    queryKey: ["sync-monitor", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sync-monitor/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      const json = await res.json();
      return json.data;
    },
    enabled: !session || isMaster,
    refetchInterval: autoRefresh ? 60_000 : false,
  });

  // ── 2. 충돌 추이 (7일)
  const trendQuery = useQuery<Array<{ date: string; count: number }>>({
    queryKey: ["sync-monitor", "trend"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sync-monitor/trend");
      if (!res.ok) throw new Error("Failed to fetch trend");
      const json = await res.json();
      return json.data.trend;
    },
    enabled: !session || isMaster,
    refetchInterval: autoRefresh ? 60_000 : false,
  });

  // ── 3. 활성 충돌 목록 — 커서 페이지네이션 (20건씩)
  const conflictsQuery = useInfiniteQuery<ConflictsPage>({
    queryKey: ["sync-monitor", "conflicts"],
    queryFn: async ({ pageParam }) => {
      const cursorParam = pageParam ? `&cursor=${encodeURIComponent(pageParam as string)}` : "";
      const res = await fetch(
        `/api/admin/sync-monitor/conflicts?limit=${CONFLICTS_PAGE_SIZE}${cursorParam}`
      );
      if (!res.ok) throw new Error("Failed to fetch conflicts");
      const json = await res.json();
      return json.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !session || isMaster,
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-monitor"] });
  };

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
      queryClient.invalidateQueries({ queryKey: ["sync-monitor", "summary"] });
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

  const summary = summaryQuery.data?.summary;
  const cronHistory = summaryQuery.data?.cronHistory ?? [];
  const conflicts = conflictsQuery.data?.pages.flatMap((p) => p.items) ?? [];

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
  const formattedTrend = (trendQuery.data || []).map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    }),
  }));

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
            onClick={refetchAll}
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

      {/* Summary Cards — summary 응답만 오면 즉시 렌더 */}
      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <Card className="p-6">
          <p className="text-sm text-destructive text-center">
            요약 정보를 불러오지 못했습니다
          </p>
        </Card>
      ) : (
        <>
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
        </>
      )}

      {/* Conflict Trend Chart — 개별 스켈레톤으로 부분 렌더 */}
      {trendQuery.isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-[250px] w-full" />
        </Card>
      ) : (
        formattedTrend.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">충돌 추이 (7일)</h2>
            <ConflictTrendChart data={formattedTrend} />
          </Card>
        )
      )}

      {/* Cron History Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Cron 실행 이력 (최근 10회)
        </h2>
        {summaryQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : cronHistory.length === 0 ? (
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
                {cronHistory.map((log) => {
                  const meta = log.metadata as {
                    durationMs?: number;
                    stock?: {
                      synced: number;
                      totalProducts: number;
                      conflicts?: number;
                      errors?: number;
                    };
                  } | null;
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

      {/* Active Conflicts — 20건씩 페이지네이션 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">활성 충돌</h2>
          {(summary?.activeConflicts ?? 0) > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              {summary!.activeConflicts.toLocaleString()}건
            </span>
          )}
        </div>

        {conflictsQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : conflictsQuery.isError ? (
          <p className="text-sm text-destructive py-4 text-center">
            충돌 목록을 불러오지 못했습니다
          </p>
        ) : conflicts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            재고 충돌이 없습니다
          </p>
        ) : (
          <>
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
                  {conflicts.map((c) => (
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

            {/* 더보기 — 커서 페이지네이션 */}
            {conflictsQuery.hasNextPage && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => conflictsQuery.fetchNextPage()}
                  disabled={conflictsQuery.isFetchingNextPage}
                >
                  {conflictsQuery.isFetchingNextPage ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      불러오는 중...
                    </>
                  ) : (
                    <>
                      더보기 ({conflicts.length.toLocaleString()}
                      {summary?.activeConflicts
                        ? ` / ${summary.activeConflicts.toLocaleString()}`
                        : ""}
                      건)
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
