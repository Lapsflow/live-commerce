"use client";

/**
 * 방송별 통합 발주서 (기획서 v2 6페이지)
 *
 * "OO방송 / 스스센터 제품 X개 + 본사 제품 Y개" 형태로 표시
 *
 * 권한: MASTER 전용
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Building2,
  Package,
  Calendar as CalendarIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";

type GroupedBroadcast = {
  broadcastId: string;
  broadcastTitle: string;
  broadcastScheduledAt: string | null;
  sellerName: string;
  hqItemCount: number;
  centerItemCount: number;
  hqAmount: number;
  centerAmount: number;
  orderCount: number;
  orderIds: string[];
  centersInvolved: Array<{ id: string; name: string; code: string }>;
  latestOrderAt: string;
};

function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDateTime(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function OrdersByBroadcastPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  // MASTER만 접근 가능
  useEffect(() => {
    if (sessionStatus === "authenticated" && userRole !== "MASTER") {
      router.replace("/dashboard");
    }
  }, [sessionStatus, userRole, router]);

  const [from, setFrom] = useState<string>(todayStr(-30));
  const [to, setTo] = useState<string>(todayStr(0));
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [data, setData] = useState<GroupedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/orders/by-broadcast?${params}`);
      const json = await res.json();
      if (res.ok && json.data?.broadcasts) {
        setData(json.data.broadcasts);
      } else {
        setError(json.error?.message || "조회 실패");
      }
    } catch (err: any) {
      setError(err?.message || "서버 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 요약 합계
  const summary = useMemo(() => {
    return data.reduce(
      (acc, g) => {
        acc.hqItemCount += g.hqItemCount;
        acc.centerItemCount += g.centerItemCount;
        acc.hqAmount += g.hqAmount;
        acc.centerAmount += g.centerAmount;
        acc.broadcastCount += 1;
        acc.orderCount += g.orderCount;
        return acc;
      },
      {
        broadcastCount: 0,
        orderCount: 0,
        hqItemCount: 0,
        centerItemCount: 0,
        hqAmount: 0,
        centerAmount: 0,
      }
    );
  }, [data]);

  if (sessionStatus === "authenticated" && userRole !== "MASTER") return null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Radio className="h-8 w-8 text-red-600" />
        <div>
          <h1 className="text-3xl font-bold">방송별 통합 발주서</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            방송 단위로 본사 제품과 센터 제품 발주를 한눈에 확인하세요
          </p>
        </div>
      </div>

      {/* 필터 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-grey-600 block mb-1">시작일</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-grey-600 block mb-1">종료일</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-grey-600 block mb-1">발주 상태</label>
            <select
              className="px-3 py-2 border border-grey-300 rounded-md text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">전체</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "조회"}
          </Button>
        </div>
      </Card>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">방송 수</div>
          <div className="text-2xl font-bold mt-1">{summary.broadcastCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">발주 건수</div>
          <div className="text-2xl font-bold mt-1">{summary.orderCount}</div>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50/40">
          <div className="text-xs text-red-700 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> 본사 제품 합계
          </div>
          <div className="text-lg font-bold mt-1 text-red-900">{summary.hqItemCount}개</div>
          <div className="text-xs text-red-700">{formatKRW(summary.hqAmount)}</div>
        </Card>
        <Card className="p-4 border-blue-200 bg-blue-50/40">
          <div className="text-xs text-blue-700 flex items-center gap-1">
            <Package className="h-3 w-3" /> 센터 제품 합계
          </div>
          <div className="text-lg font-bold mt-1 text-blue-900">{summary.centerItemCount}개</div>
          <div className="text-xs text-blue-700">{formatKRW(summary.centerAmount)}</div>
        </Card>
      </div>

      {/* 에러 */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </Card>
      )}

      {/* 본문 */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <Card className="p-12 text-center">
          <Radio className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <div className="text-muted-foreground">
            선택한 기간에 발주가 묶인 방송이 없습니다
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((g) => (
            <Card key={g.broadcastId} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* 좌측 — 방송 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="h-4 w-4 text-red-600 shrink-0" />
                    <h3 className="font-semibold text-base truncate">
                      {g.broadcastTitle}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDateTime(g.broadcastScheduledAt)}
                    </span>
                    <span>방송 셀러: {g.sellerName}</span>
                    <span>발주 {g.orderCount}건</span>
                  </div>

                  {/* 통합 표시 — 기획서 6페이지 핵심 문구 */}
                  <div className="mt-3 p-3 bg-grey-50 rounded-lg border">
                    <div className="text-xs text-muted-foreground mb-1">통합 발주서</div>
                    <div className="text-sm font-medium leading-relaxed">
                      <span className="text-red-700">
                        본사 제품 <span className="font-bold">{g.hqItemCount}개</span>
                      </span>
                      <span className="mx-2 text-grey-400">+</span>
                      <span className="text-blue-700">
                        센터 제품 <span className="font-bold">{g.centerItemCount}개</span>
                      </span>
                      {g.centersInvolved.length > 0 && (
                        <span className="text-muted-foreground text-xs ml-2">
                          ({g.centersInvolved.map((c) => c.name).join(", ")})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 우측 — 금액 + 액션 */}
                <div className="flex flex-col md:items-end gap-2 md:w-56 shrink-0">
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-2 w-full">
                    <div className="text-right text-sm">
                      <div className="text-xs text-red-600">본사 매출</div>
                      <div className="font-semibold text-red-900">{formatKRW(g.hqAmount)}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-xs text-blue-600">센터 매출</div>
                      <div className="font-semibold text-blue-900">{formatKRW(g.centerAmount)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap md:justify-end">
                    {g.centersInvolved.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs font-mono">
                        {c.code}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
