"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  userId: string | null;
  userRole: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  ipAddress: string | null;
  description: string | null;
  createdAt: string;
  user: { id: string; name: string; role: string } | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "생성", color: "bg-green-100 text-green-800" },
  UPDATE: { label: "수정", color: "bg-blue-100 text-blue-800" },
  DELETE: { label: "삭제", color: "bg-red-100 text-red-800" },
  SOFT_DELETE: { label: "비활성화", color: "bg-red-100 text-red-800" },
  RESTORE: { label: "복원", color: "bg-green-100 text-green-800" },
  LOGIN: { label: "로그인", color: "bg-gray-100 text-gray-800" },
  LOGOUT: { label: "로그아웃", color: "bg-gray-100 text-gray-800" },
  LOGIN_FAILED: { label: "로그인실패", color: "bg-orange-100 text-orange-800" },
  ROLE_CHANGED: { label: "역할변경", color: "bg-purple-100 text-purple-800" },
  PERMISSION_DENIED: { label: "권한거부", color: "bg-red-100 text-red-800" },
  EXPORT: { label: "내보내기", color: "bg-gray-100 text-gray-800" },
  IMPORT: { label: "가져오기", color: "bg-blue-100 text-blue-800" },
  PASSWORD_CHANGED: { label: "비밀번호변경", color: "bg-yellow-100 text-yellow-800" },
  STATUS_CHANGED: { label: "상태변경", color: "bg-indigo-100 text-indigo-800" },
};

const ENTITY_TYPES = ["User", "Product", "Order", "Broadcast", "Center", "TaxInvoice", "API"];
const ACTION_TYPES = Object.keys(ACTION_LABELS);

export default function AuditLogPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 50;

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageIndex", String(pageIndex));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityType", entityFilter);
      if (userIdFilter) params.set("userId", userIdFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      const json = await res.json();

      // 2026-07-10 수정: paginated() 응답엔 success 필드가 없어 항상 빈 표였음 (학습 #9 계열)
      if (res.ok) {
        setLogs(json.data ?? []);
        setTotal(json.totalCount ?? 0);
      }
    } catch (err) {
      console.error("AuditLog load error:", err);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, search, actionFilter, entityFilter, userIdFilter, startDate, endDate]);

  useEffect(() => {
    if (userRole === "MASTER") {
      loadLogs();
    }
  }, [userRole, loadLogs]);

  const handleSearch = () => {
    setPageIndex(0);
    loadLogs();
  };

  const handleReset = () => {
    setSearch("");
    setActionFilter("");
    setEntityFilter("");
    setUserIdFilter("");
    setStartDate("");
    setEndDate("");
    setPageIndex(0);
  };

  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    params.set("pageIndex", "0");
    params.set("pageSize", "10000");
    if (search) params.set("search", search);
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entityType", entityFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const res = await fetch(`/api/admin/audit-log?${params}`);
    const json = await res.json();

    if (!res.ok) return; // 2026-07-10: success 필드 없음 (paginated 응답)

    const rows = (json.data ?? []) as AuditLog[];
    const csvHeader = "시각,사용자,역할,액션,대상,엔티티명,설명,IP\n";
    const csvRows = rows.map((log: AuditLog) =>
      [
        new Date(log.createdAt).toLocaleString("ko-KR"),
        log.userName || "-",
        log.userRole || "-",
        ACTION_LABELS[log.action]?.label || log.action,
        log.entityType,
        log.entityName || "-",
        `"${(log.description || "").replace(/"/g, '""')}"`,
        log.ipAddress || "-",
      ].join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csvHeader + csvRows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (userRole !== "MASTER") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">접근 권한이 없습니다 (MASTER 전용)</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <h1 className="text-2xl font-bold">변경 이력</h1>
          <Badge variant="secondary">{total}건</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Input
              placeholder="검색 (설명, 이름)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v || "all")}>
              <SelectTrigger>
                {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                <span className={actionFilter ? "" : "text-grey-500"}>
                  {actionFilter
                    ? actionFilter === "all"
                      ? "전체"
                      : (ACTION_LABELS[actionFilter]?.label ?? actionFilter)
                    : "액션"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v || "all")}>
              <SelectTrigger>
                {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                <span className={entityFilter ? "" : "text-grey-500"}>
                  {entityFilter ? (entityFilter === "all" ? "전체" : entityFilter) : "대상"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {ENTITY_TYPES.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="시작일"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="종료일"
            />
            <div className="flex gap-1">
              <Button onClick={handleSearch} size="sm" className="flex-1">
                <Search className="h-4 w-4" />
              </Button>
              <Button onClick={handleReset} variant="ghost" size="sm">
                초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">로딩 중...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">데이터 없음</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">시각</th>
                    <th className="text-left p-3 font-medium">사용자</th>
                    <th className="text-left p-3 font-medium">액션</th>
                    <th className="text-left p-3 font-medium">대상</th>
                    <th className="text-left p-3 font-medium">설명</th>
                    <th className="text-left p-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action] || {
                      label: log.action,
                      color: "bg-gray-100 text-gray-800",
                    };
                    return (
                      <tr
                        key={log.id}
                        className="border-b hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("ko-KR")}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{log.userName || "-"}</span>
                            {log.userRole && (
                              <span className="text-xs text-muted-foreground">{log.userRole}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionInfo.color}`}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{log.entityType}</span>
                            <span className="font-medium truncate max-w-[200px]">
                              {log.entityName || log.entityId || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 max-w-[300px] truncate text-muted-foreground">
                          {log.description || "-"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {log.ipAddress || "-"}
                        </td>
                      </tr>
                    );
                  })}
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
            {pageIndex * pageSize + 1}-{Math.min((pageIndex + 1) * pageSize, total)} / {total}건
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>변경 이력 상세</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">시각</p>
                    <p className="font-medium">
                      {new Date(selectedLog.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">사용자</p>
                    <p className="font-medium">
                      {selectedLog.userName || "-"} ({selectedLog.userRole || "-"})
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">액션</p>
                    <p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ACTION_LABELS[selectedLog.action]?.color || "bg-gray-100"
                        }`}
                      >
                        {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">대상</p>
                    <p className="font-medium">
                      {selectedLog.entityType} / {selectedLog.entityName || selectedLog.entityId || "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">설명</p>
                    <p>{selectedLog.description || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">IP</p>
                    <p>{selectedLog.ipAddress || "-"}</p>
                  </div>
                </div>

                {/* Diff view */}
                {selectedLog.diff && Object.keys(selectedLog.diff).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">변경 내용</p>
                    <div className="bg-muted rounded-lg p-3 space-y-2">
                      {Object.entries(selectedLog.diff).map(([key, val]) => {
                        const v = val as { from: unknown; to: unknown };
                        return (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <span className="font-mono text-muted-foreground min-w-[120px]">
                              {key}
                            </span>
                            <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs line-through">
                              {formatValue(v.from)}
                            </span>
                            <span className="text-muted-foreground">&rarr;</span>
                            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">
                              {formatValue(v.to)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Before/After JSON */}
                {!selectedLog.diff && (selectedLog.before || selectedLog.after) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLog.before && (
                      <div>
                        <p className="text-sm font-medium mb-1">Before</p>
                        <pre className="bg-red-50 rounded p-2 text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.after && (
                      <div>
                        <p className="text-sm font-medium mb-1">After</p>
                        <pre className="bg-green-50 rounded p-2 text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(없음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return String(v);
}
