"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PlayCircle,
  StopCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Radio,
  Clock,
  ListFilter,
  FlaskConical,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { StartBroadcastDialog } from "@/components/broadcasts/StartBroadcastDialog";
import { Input } from "@/components/ui/input";
import {
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_COLORS,
} from "@/lib/constants/sample-labels";

type Broadcast = {
  id: string;
  code: string;
  sellerId: string;
  seller?: { name: string; email: string };
  platform: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  title?: string | null;
  expectedProducts?: string | null;
  memo: string | null;
  requestMemo: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type SampleProduct = {
  id: string;
  code: string;
  name: string;
  barcode: string;
  totalStock: number;
  sampleStatus: string | null;
};

const platformLabels: Record<string, string> = {
  GRIP: "그립",
  CLME: "클릭메이트",
  YOUTUBE: "유튜브",
  TIKTOK: "틱톡",
  BAND: "밴드",
  OTHER: "기타",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "신청 대기", color: "bg-amber-100 text-amber-800" },
  SCHEDULED: { label: "예정", color: "bg-blue-100 text-blue-800" },
  LIVE: { label: "라이브", color: "bg-red-100 text-red-800 animate-pulse" },
  ENDED: { label: "종료", color: "bg-grey-100 text-grey-800" },
  CANCELED: { label: "취소", color: "bg-orange-100 text-orange-800" },
  REJECTED: { label: "반려", color: "bg-grey-100 text-grey-500" },
};

export default function BroadcastsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Start dialog
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Approve dialog (한국무진 확정 2026-07-03: 승인 단계에서 샘플 상태 보고 거름)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Broadcast | null>(null);
  const [sampleSearch, setSampleSearch] = useState("");
  const [sampleResults, setSampleResults] = useState<SampleProduct[]>([]);
  const [sampleLoading, setSampleLoading] = useState(false);

  const userRole = (session?.user as any)?.role;
  const isManagerOrAbove =
    userRole === "MASTER" || userRole === "SUB_MASTER";

  const loadBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/broadcasts?pageSize=100&sort=-scheduledAt");
      const data = await res.json();
      if (res.ok && data.data) {
        setBroadcasts(data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBroadcasts();
  }, []);

  // Filtered lists
  const requested = useMemo(
    () => broadcasts.filter((b) => b.status === "REQUESTED"),
    [broadcasts]
  );
  const scheduled = useMemo(
    () => broadcasts.filter((b) => b.status === "SCHEDULED"),
    [broadcasts]
  );
  const live = useMemo(
    () => broadcasts.filter((b) => b.status === "LIVE"),
    [broadcasts]
  );

  // Actions
  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/broadcasts/${id}/approve`, { method: "PUT" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "승인 실패");
      }
      toast({ title: "승인 완료", description: "방송이 예정 상태로 변경되었습니다." });
      setApproveDialogOpen(false);
      setApproveTarget(null);
      loadBroadcasts();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // 승인 다이얼로그 열기: 샘플 상태 확인 후 승인 (자동 차단 아님 — 마스터 판단)
  const openApproveDialog = (id: string) => {
    const target = broadcasts.find((b) => b.id === id) || null;
    setApproveTarget(target);
    setSampleSearch("");
    setApproveDialogOpen(true);
  };

  // 샘플 검색 (isSample=true 상품만 반환됨 — 미등록 상품은 결과에 안 나옴)
  useEffect(() => {
    if (!approveDialogOpen) return;
    const timeout = setTimeout(async () => {
      setSampleLoading(true);
      try {
        const params = new URLSearchParams();
        if (sampleSearch.trim()) params.set("search", sampleSearch.trim());
        const res = await fetch(`/api/samples?${params.toString()}`);
        const data = await res.json();
        setSampleResults(res.ok && data.data ? data.data : []);
      } catch {
        setSampleResults([]);
      } finally {
        setSampleLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [approveDialogOpen, sampleSearch]);

  const handleRejectSubmit = async () => {
    if (!rejectTargetId || !rejectReason.trim()) return;
    setActionLoading(rejectTargetId);
    try {
      const res = await fetch(`/api/broadcasts/${rejectTargetId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "반려 실패");
      }
      toast({ title: "반려 완료" });
      setRejectDialogOpen(false);
      setRejectReason("");
      loadBroadcasts();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = (id: string) => {
    setSelectedBroadcastId(id);
    setStartDialogOpen(true);
  };

  const handleEnd = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/broadcasts/${id}/end`, { method: "PUT" });
      if (!res.ok) throw new Error("방송 종료 실패");
      toast({ title: "방송 종료" });
      loadBroadcasts();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * 방송 영구 삭제 (MASTER/SUB_MASTER 전용)
   * Broadcast cascade 관계:
   *   - Order.broadcastId (SetNull)  — 이력 보존
   *   - Sale.broadcastId (SetNull)   — 이력 보존
   *   - ScanLog.broadcastId (SetNull) — 이력 보존
   * 즉 삭제해도 발주/매출/스캔 이력은 유지되며 방송 참조만 null 처리.
   */
  const handleDeleteBroadcast = async (id: string) => {
    const target = broadcasts.find((b) => b.id === id);
    const label = target ? `${target.code} (${target.seller?.name || "-"})` : id;
    if (!confirm(
      `방송을 영구 삭제하시겠습니까?\n\n` +
      `${label}\n\n` +
      `⚠️ 이 작업은 되돌릴 수 없습니다.\n` +
      `연결된 발주/매출/스캔 이력은 유지되며 방송 참조만 해제됩니다.`
    )) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/broadcasts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "방송 삭제 실패");
      }
      toast({ title: "방송 삭제 완료" });
      loadBroadcasts();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-grey-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">방송 관리</h1>
        <Link href="/broadcasts/calendar">
          <Button>
            <Calendar className="mr-2 h-4 w-4" />
            캘린더 / 신청
          </Button>
        </Link>
      </div>

      <Tabs defaultValue={requested.length > 0 && isManagerOrAbove ? "requested" : "all"}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <ListFilter className="h-4 w-4" />
            전체 ({broadcasts.length})
          </TabsTrigger>
          {isManagerOrAbove && (
            <TabsTrigger value="requested" className="gap-1.5">
              <Clock className="h-4 w-4" />
              신청 대기 ({requested.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="scheduled" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            예정 ({scheduled.length})
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Radio className="h-4 w-4" />
            진행중 ({live.length})
          </TabsTrigger>
        </TabsList>

        {/* 전체 */}
        <TabsContent value="all">
          <BroadcastTable
            broadcasts={broadcasts}
            onStart={handleStart}
            onEnd={handleEnd}
            onApprove={isManagerOrAbove ? openApproveDialog : undefined}
            onReject={
              isManagerOrAbove
                ? (id) => {
                    setRejectTargetId(id);
                    setRejectReason("");
                    setRejectDialogOpen(true);
                  }
                : undefined
            }
            onDelete={isManagerOrAbove ? handleDeleteBroadcast : undefined}
            actionLoading={actionLoading}
          />
        </TabsContent>

        {/* 신청 대기 */}
        {isManagerOrAbove && (
          <TabsContent value="requested">
            <BroadcastTable
              broadcasts={requested}
              onApprove={openApproveDialog}
              onReject={(id) => {
                setRejectTargetId(id);
                setRejectReason("");
                setRejectDialogOpen(true);
              }}
              onDelete={handleDeleteBroadcast}
              actionLoading={actionLoading}
              showRequestMemo
            />
          </TabsContent>
        )}

        {/* 예정 */}
        <TabsContent value="scheduled">
          <BroadcastTable
            broadcasts={scheduled}
            onStart={handleStart}
            onDelete={isManagerOrAbove ? handleDeleteBroadcast : undefined}
            actionLoading={actionLoading}
          />
        </TabsContent>

        {/* 진행중 */}
        <TabsContent value="live">
          <BroadcastTable
            broadcasts={live}
            onEnd={handleEnd}
            onDelete={isManagerOrAbove ? handleDeleteBroadcast : undefined}
            actionLoading={actionLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Start Dialog */}
      {selectedBroadcastId && (
        <StartBroadcastDialog
          open={startDialogOpen}
          onOpenChange={setStartDialogOpen}
          broadcastId={selectedBroadcastId}
          onSuccess={() => loadBroadcasts()}
        />
      )}

      {/* Approve Dialog — 샘플 상태 확인 후 승인 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>방송 승인 검토</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 py-1">
              {/* 신청 정보 */}
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-grey-500">판매자</span>
                  <span>{approveTarget.seller?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-grey-500">플랫폼 / 예정시간</span>
                  <span>
                    {platformLabels[approveTarget.platform] || approveTarget.platform}
                    {" · "}
                    {new Date(approveTarget.scheduledAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                {approveTarget.title && (
                  <div className="flex justify-between">
                    <span className="text-grey-500">제목</span>
                    <span className="max-w-[340px] truncate">{approveTarget.title}</span>
                  </div>
                )}
                {approveTarget.expectedProducts && (
                  <div>
                    <span className="text-grey-500">예상 상품</span>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">
                      {approveTarget.expectedProducts}
                    </p>
                  </div>
                )}
                {approveTarget.requestMemo && (
                  <div>
                    <span className="text-grey-500">신청 메모</span>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">
                      {approveTarget.requestMemo}
                    </p>
                  </div>
                )}
              </div>

              {/* 샘플 상태 확인 패널 */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <FlaskConical className="h-4 w-4 text-purple-500" />
                  샘플 상태 확인
                  <span className="text-xs font-normal text-grey-400">
                    샘플 미등록 상품은 검색 결과에 나오지 않습니다
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-grey-400" />
                  <Input
                    value={sampleSearch}
                    onChange={(e) => setSampleSearch(e.target.value)}
                    placeholder="상품명, 바코드, 상품코드 검색"
                    className="pl-8"
                  />
                </div>
                <div className="max-h-[180px] overflow-y-auto rounded-md border divide-y">
                  {sampleLoading ? (
                    <p className="p-3 text-sm text-grey-400">검색 중...</p>
                  ) : sampleResults.length === 0 ? (
                    <p className="p-3 text-sm text-grey-400">
                      등록된 샘플이 없습니다
                    </p>
                  ) : (
                    sampleResults.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span className="truncate">
                          <span className="font-mono text-xs text-grey-400 mr-1.5">
                            {p.code}
                          </span>
                          {p.name}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-grey-400">
                            재고 {p.totalStock}
                          </span>
                          {p.sampleStatus && SAMPLE_STATUS_LABELS[p.sampleStatus] && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${SAMPLE_STATUS_COLORS[p.sampleStatus]}`}
                            >
                              {SAMPLE_STATUS_LABELS[p.sampleStatus]}
                            </Badge>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-grey-400">
                  샘플이 진행중인 상품만 방송 승인 대상입니다. 확인 후 승인해주세요.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={!!actionLoading}
            >
              취소
            </Button>
            <Button
              onClick={() => approveTarget && handleApprove(approveTarget.id)}
              disabled={!approveTarget || !!actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {actionLoading ? "처리 중..." : "승인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>방송 신청 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력해주세요"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || !!actionLoading}
            >
              {actionLoading ? "처리 중..." : "반려"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Broadcast Table Component ──────────────────────────

function BroadcastTable({
  broadcasts,
  onStart,
  onEnd,
  onApprove,
  onReject,
  onDelete,
  actionLoading,
  showRequestMemo,
}: {
  broadcasts: Broadcast[];
  onStart?: (id: string) => void;
  onEnd?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
  actionLoading: string | null;
  showRequestMemo?: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-grey-200">
          <thead>
            <tr className="bg-grey-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                방송코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                판매자
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                플랫폼
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                상태
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                예정시간
              </th>
              {showRequestMemo && (
                <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                  신청 메모
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-200">
            {broadcasts.length === 0 ? (
              <tr>
                <td
                  colSpan={showRequestMemo ? 7 : 6}
                  className="px-4 py-8 text-center text-grey-500"
                >
                  해당 방송이 없습니다
                </td>
              </tr>
            ) : (
              broadcasts.map((b) => {
                const cfg = statusConfig[b.status] || {
                  label: b.status,
                  color: "bg-grey-100",
                };
                const isLoading = actionLoading === b.id;

                return (
                  <tr key={b.id} className="hover:bg-grey-50">
                    <td className="px-4 py-3 text-sm font-mono">{b.code}</td>
                    <td className="px-4 py-3 text-sm">
                      {b.seller?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {platformLabels[b.platform] || b.platform}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline" className={cfg.color}>
                        {cfg.label}
                      </Badge>
                      {b.status === "REJECTED" && b.rejectionReason && (
                        <p className="text-xs text-grey-400 mt-1">
                          사유: {b.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-grey-600">
                      {new Date(b.scheduledAt).toLocaleString("ko-KR")}
                    </td>
                    {showRequestMemo && (
                      <td className="px-4 py-3 text-sm text-grey-600 max-w-[200px] truncate">
                        {b.requestMemo || "-"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right space-x-1">
                      {b.status === "REQUESTED" && onApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApprove(b.id)}
                          disabled={isLoading}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          승인
                        </Button>
                      )}
                      {b.status === "REQUESTED" && onReject && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(b.id)}
                          disabled={isLoading}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          반려
                        </Button>
                      )}
                      {b.status === "SCHEDULED" && onStart && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onStart(b.id)}
                          disabled={isLoading}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          시작
                        </Button>
                      )}
                      {b.status === "LIVE" && onEnd && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onEnd(b.id)}
                          disabled={isLoading}
                        >
                          <StopCircle className="h-4 w-4 mr-1" />
                          종료
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(b.id)}
                          disabled={isLoading}
                          title="영구 삭제"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {broadcasts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-grey-200">
          <p className="text-sm text-grey-600">
            총 <span className="font-semibold">{broadcasts.length}</span>건
          </p>
        </div>
      )}
    </Card>
  );
}
