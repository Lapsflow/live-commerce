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
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { StartBroadcastDialog } from "@/components/broadcasts/StartBroadcastDialog";

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
  memo: string | null;
  requestMemo: string | null;
  rejectionReason: string | null;
  createdAt: string;
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

  const userRole = (session?.user as any)?.role;
  const isManagerOrAbove =
    userRole === "MASTER" || userRole === "SUB_MASTER" || userRole === "ADMIN";

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
      loadBroadcasts();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

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
            onApprove={isManagerOrAbove ? handleApprove : undefined}
            onReject={
              isManagerOrAbove
                ? (id) => {
                    setRejectTargetId(id);
                    setRejectReason("");
                    setRejectDialogOpen(true);
                  }
                : undefined
            }
            actionLoading={actionLoading}
          />
        </TabsContent>

        {/* 신청 대기 */}
        {isManagerOrAbove && (
          <TabsContent value="requested">
            <BroadcastTable
              broadcasts={requested}
              onApprove={handleApprove}
              onReject={(id) => {
                setRejectTargetId(id);
                setRejectReason("");
                setRejectDialogOpen(true);
              }}
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
            actionLoading={actionLoading}
          />
        </TabsContent>

        {/* 진행중 */}
        <TabsContent value="live">
          <BroadcastTable
            broadcasts={live}
            onEnd={handleEnd}
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
  actionLoading,
  showRequestMemo,
}: {
  broadcasts: Broadcast[];
  onStart?: (id: string) => void;
  onEnd?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
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
