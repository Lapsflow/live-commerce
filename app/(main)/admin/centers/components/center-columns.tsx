"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, XCircle, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CenterWithStats } from "@/lib/services/center/centerService";

export const centerColumns: ColumnDef<CenterWithStats>[] = [
  {
    accessorKey: "code",
    header: "센터코드",
    cell: ({ row }) => (
      <div className="font-mono font-medium">{row.getValue("code")}</div>
    ),
  },
  {
    accessorKey: "name",
    header: "센터명",
    cell: ({ row }) => (
      <div className="font-semibold">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "regionName",
    header: "지역",
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.getValue("regionName")}</div>
    ),
  },
  {
    accessorKey: "representative",
    header: "대표자",
    cell: ({ row }) => {
      const representative = row.getValue("representative") as string;
      const phone = row.original.representativePhone;
      return (
        <div>
          <div className="font-medium">{representative}</div>
          <div className="text-sm text-muted-foreground">{phone}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "_count.users",
    header: "사용자",
    cell: ({ row }) => {
      const count = row.original._count?.users || 0;
      return (
        <div className="text-center">
          <span className="font-semibold">{count}</span>
          <span className="text-sm text-muted-foreground">명</span>
        </div>
      );
    },
  },
  {
    accessorKey: "_count.centerStocks",
    header: "상품",
    cell: ({ row }) => {
      const count = row.original._count?.centerStocks || 0;
      return (
        <div className="text-center">
          <span className="font-semibold">{count}</span>
          <span className="text-sm text-muted-foreground">개</span>
        </div>
      );
    },
  },
  {
    accessorKey: "_count.orders",
    header: "주문",
    cell: ({ row }) => {
      const count = row.original._count?.orders || 0;
      return (
        <div className="text-center">
          <span className="font-semibold">{count}</span>
          <span className="text-sm text-muted-foreground">건</span>
        </div>
      );
    },
  },
  {
    accessorKey: "isActive",
    header: "상태",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive");
      return (
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "활성" : "비활성"}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(String(row.getValue(id)));
    },
  },
  {
    id: "actions",
    header: "작업",
    cell: ({ row }) => {
      const center = row.original;
      const router = useRouter();

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>작업</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push(`/admin/centers/${center.id}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              상세보기
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/admin/centers/${center.id}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              수정
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(`/admin/centers/${center.id}/stats`)}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              통계
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                if (confirm(`${center.name} 센터를 비활성화하시겠습니까?`)) {
                  try {
                    const res = await fetch(`/api/centers/${center.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ isActive: false }),
                    });
                    if (res.ok) {
                      window.location.reload();
                    } else {
                      alert("비활성화에 실패했습니다.");
                    }
                  } catch (err) {
                    alert("오류가 발생했습니다.");
                  }
                }
              }}
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              비활성화
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
