"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLog {
  id: string;
  userName: string | null;
  userRole: string | null;
  action: string;
  description: string | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  SOFT_DELETE: "bg-red-100 text-red-800",
  ROLE_CHANGED: "bg-purple-100 text-purple-800",
  STATUS_CHANGED: "bg-indigo-100 text-indigo-800",
  IMPORT: "bg-blue-100 text-blue-800",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "생성",
  UPDATE: "수정",
  DELETE: "삭제",
  SOFT_DELETE: "비활성화",
  ROLE_CHANGED: "역할변경",
  STATUS_CHANGED: "상태변경",
  IMPORT: "가져오기",
};

interface EntityHistoryProps {
  entityType: string;
  entityId: string;
  className?: string;
}

export function EntityHistory({ entityType, entityId, className }: EntityHistoryProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          entityType,
          entityId,
          pageSize: "20",
        });
        const res = await fetch(`/api/admin/audit-log?${params}`);
        const json = await res.json();
        // 2026-07-10 수정: paginated() 응답엔 success 필드가 없어 이력이 항상 미표시였음
        if (res.ok) {
          setLogs(json.data ?? []);
        }
      } catch (err) {
        console.error("History load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [entityType, entityId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">이력 로딩 중...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">변경 이력이 없습니다</p>;
  }

  return (
    <ScrollArea className={className || "max-h-[400px]"}>
      <div className="space-y-3 p-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 text-sm">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
              <div className="w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}`}>
                  {ACTION_LABELS[log.action] || log.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {log.userName || "시스템"} ({log.userRole || "-"})
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(log.createdAt).toLocaleString("ko-KR")}
                </span>
              </div>
              {log.description && (
                <p className="text-muted-foreground text-xs">{log.description}</p>
              )}
              {log.diff && Object.keys(log.diff).length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {Object.entries(log.diff).map(([key, val]) => {
                    const v = val as { from: unknown; to: unknown };
                    return (
                      <div key={key} className="text-xs flex items-center gap-1">
                        <span className="font-mono text-muted-foreground">{key}:</span>
                        <span className="text-red-600 line-through">{formatValue(v.from)}</span>
                        <span className="text-muted-foreground">&rarr;</span>
                        <span className="text-green-600">{formatValue(v.to)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(없음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return String(v);
}
