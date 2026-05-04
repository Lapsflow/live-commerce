"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowLeft,
  Upload,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface UploadHistoryItem {
  id: string;
  userName: string | null;
  userRole: string | null;
  centerId: string | null;
  stats: {
    updated: number;
    created: number;
    reactivated: number;
    deactivated: number;
  } | null;
  priceChangeCount: number;
  durationMs: number | null;
  canRollback: boolean;
  createdAt: string;
}

interface Center {
  id: string;
  name: string;
}

export default function UploadHistoryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const userRole = (session?.user as any)?.role;

  const [items, setItems] = useState<UploadHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState("");

  // Rollback state
  const [rollbackTarget, setRollbackTarget] = useState<UploadHistoryItem | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  // Load centers for MASTER filter
  useEffect(() => {
    if (userRole === "MASTER") {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) {
            setCenters(json.data);
          }
        })
        .catch(() => {});
    }
  }, [userRole]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (centerId) params.set("centerId", centerId);

      const res = await fetch(`/api/products/upload/history?${params}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setItems(json.data.items);
        setTotalCount(json.data.totalCount);
      }
    } catch (err) {
      console.error("History load error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, centerId]);

  useEffect(() => {
    if (userRole === "MASTER" || userRole === "SUB_MASTER") {
      loadHistory();
    }
  }, [userRole, loadHistory]);

  const handleRollback = async () => {
    if (!rollbackTarget) return;

    setRollbackLoading(true);
    try {
      const res = await fetch("/api/products/upload/rollback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ auditLogId: rollbackTarget.id }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        toast({
          title: "롤백 완료",
          description: `복원 ${json.data.restored}, 비활성화 ${json.data.deactivated}, 원복 ${json.data.reverted}`,
        });
        setRollbackTarget(null);
        loadHistory();
      } else {
        toast({
          title: "롤백 실패",
          description: json.error || "알 수 없는 오류",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "롤백 실패",
        description: "네트워크 오류",
        variant: "destructive",
      });
    } finally {
      setRollbackLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (userRole !== "MASTER" && userRole !== "SUB_MASTER") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">접근 권한이 없습니다 (MASTER/SUB_MASTER 전용)</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/products/upload">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <History className="h-5 w-5" />
          <h1 className="text-2xl font-bold">엑셀 업로드 이력</h1>
          <Badge variant="secondary">최근 30일</Badge>
        </div>
        <Link href="/products/upload">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            새 업로드
          </Button>
        </Link>
      </div>

      {/* Center filter (MASTER only) */}
      {userRole === "MASTER" && centers.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Select
                value={centerId}
                onValueChange={(v) => {
                  setCenterId(!v || v === "all" ? "" : v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="전체 센터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 센터</SelectItem>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{totalCount}건</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">로딩 중...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">업로드 이력이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">일시</th>
                    <th className="text-left p-3 font-medium">사용자</th>
                    <th className="text-right p-3 font-medium">업데이트</th>
                    <th className="text-right p-3 font-medium">신규</th>
                    <th className="text-right p-3 font-medium">재활성화</th>
                    <th className="text-right p-3 font-medium">비활성화</th>
                    <th className="text-right p-3 font-medium">가격변동</th>
                    <th className="text-right p-3 font-medium">소요시간</th>
                    <th className="text-center p-3 font-medium">롤백</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.userName || "-"}</span>
                          {item.userRole && (
                            <span className="text-xs text-muted-foreground">{item.userRole}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {item.stats?.updated ?? "-"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {item.stats?.created ? (
                          <span className="text-green-600 font-medium">{item.stats.created}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {item.stats?.reactivated ? (
                          <span className="text-blue-600 font-medium">{item.stats.reactivated}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {item.stats?.deactivated ? (
                          <span className="text-red-600 font-medium">{item.stats.deactivated}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {item.priceChangeCount > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {item.priceChangeCount}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-right text-xs text-muted-foreground tabular-nums">
                        {item.durationMs != null
                          ? `${(item.durationMs / 1000).toFixed(1)}s`
                          : "-"}
                      </td>
                      <td className="p-3 text-center">
                        {item.canRollback ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setRollbackTarget(item)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            롤백
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">만료</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} / {totalCount}건
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Dialog */}
      <Dialog open={!!rollbackTarget} onOpenChange={() => setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              업로드 롤백 확인
            </DialogTitle>
          </DialogHeader>

          {rollbackTarget && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">업로드 일시</span>
                  <span className="font-medium">
                    {new Date(rollbackTarget.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">업로드 사용자</span>
                  <span className="font-medium">{rollbackTarget.userName || "-"}</span>
                </div>
                {rollbackTarget.stats && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <p className="text-muted-foreground mb-1">롤백 시 되돌릴 변경:</p>
                    </div>
                    {rollbackTarget.stats.deactivated > 0 && (
                      <div className="flex justify-between">
                        <span>비활성화 상품 복원</span>
                        <span className="text-green-600 font-medium">
                          {rollbackTarget.stats.deactivated}개
                        </span>
                      </div>
                    )}
                    {rollbackTarget.stats.created > 0 && (
                      <div className="flex justify-between">
                        <span>신규 생성 상품 비활성화</span>
                        <span className="text-red-600 font-medium">
                          {rollbackTarget.stats.created}개
                        </span>
                      </div>
                    )}
                    {rollbackTarget.stats.updated > 0 && (
                      <div className="flex justify-between">
                        <span>업데이트 상품 원복</span>
                        <span className="text-blue-600 font-medium">
                          {rollbackTarget.stats.updated}개
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackTarget(null)}
              disabled={rollbackLoading}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRollback}
              disabled={rollbackLoading}
            >
              {rollbackLoading ? "롤백 중..." : "롤백 실행"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
