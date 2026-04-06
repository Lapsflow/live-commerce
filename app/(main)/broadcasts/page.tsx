"use client";

import { DataTable } from "@/components/ui/data-table/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useApiCrud } from "@/hooks/use-api-crud";
import type { Broadcast } from "@/types/broadcast";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, PlayCircle, StopCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const platformLabels = {
  GRIP: "그립",
  CLME: "클미",
  YOUTUBE: "유튜브",
  TIKTOK: "틱톡",
  BAND: "밴드",
  OTHER: "기타",
} as const;

const statusColors = {
  SCHEDULED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  LIVE: "bg-red-500/10 text-red-700 dark:text-red-400 animate-pulse",
  ENDED: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  CANCELED: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
} as const;

const statusLabels = {
  SCHEDULED: "예정",
  LIVE: "라이브",
  ENDED: "종료",
  CANCELED: "취소",
} as const;

// 컬럼 정의는 컴포넌트 내부로 이동됨 (액션 핸들러 사용)

export default function BroadcastsPage() {
  const { dataSource, refresh } = useApiCrud<Broadcast>("/api/broadcasts");
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStart = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/broadcasts/${id}/start`, {
        method: "PUT",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "방송 시작 실패");
      }

      toast({
        title: "방송 시작",
        description: "방송이 시작되었습니다.",
      });

      refresh();
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleEnd = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/broadcasts/${id}/end`, {
        method: "PUT",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "방송 종료 실패");
      }

      toast({
        title: "방송 종료",
        description: "방송이 종료되었습니다.",
      });

      refresh();
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  // 컬럼 정의를 컴포넌트 내부로 이동 (handleStart, handleEnd 사용)
  const columnsWithActions: ColumnDef<Broadcast>[] = [
    {
      accessorKey: "code",
      header: "방송코드",
    },
    {
      accessorKey: "seller",
      header: "판매자",
      cell: ({ row }) => row.original.seller?.name ?? "-",
    },
    {
      accessorKey: "platform",
      header: "플랫폼",
      cell: ({ row }) => platformLabels[row.original.platform],
    },
    {
      accessorKey: "status",
      header: "상태",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant="outline" className={statusColors[status]}>
            {statusLabels[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "scheduledAt",
      header: "예정시간",
      cell: ({ row }) => new Date(row.original.scheduledAt).toLocaleString(),
    },
    {
      id: "actions",
      header: "액션",
      cell: ({ row }) => {
        const status = row.original.status;
        const id = row.original.id;
        const isLoading = loadingId === id;

        if (status === "SCHEDULED") {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStart(id)}
              disabled={isLoading}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {isLoading ? "처리 중..." : "시작"}
            </Button>
          );
        }
        if (status === "LIVE") {
          return (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleEnd(id)}
              disabled={isLoading}
            >
              <StopCircle className="mr-2 h-4 w-4" />
              {isLoading ? "처리 중..." : "종료"}
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">방송 일정</h1>
        <Link href="/broadcasts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            방송 등록
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columnsWithActions}
        dataSource={dataSource}
        enableRowSelection={false}
      />
    </div>
  );
}
