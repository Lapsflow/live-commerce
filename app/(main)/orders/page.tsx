"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useApiCrud } from "@/hooks/use-api-crud";
import type { Order } from "@/types/order";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Plus,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import OrderPipelineCards from "./components/OrderPipelineCards";
import ExpiryTimer from "./components/ExpiryTimer";

const statusColors = {
  PENDING: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  APPROVED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400",
} as const;

const statusLabels = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "거절",
} as const;

const paymentColors = {
  UNPAID: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  PAID: "bg-green-500/10 text-green-700 dark:text-green-400",
} as const;

const paymentLabels = {
  UNPAID: "입금확인전",
  PAID: "입금완료",
} as const;

const shippingColors = {
  PENDING: "bg-grey-500/10 text-grey-700 dark:text-grey-400",
  PREPARING: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  SHIPPED: "bg-green-500/10 text-green-700 dark:text-green-400",
  PARTIAL: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
} as const;

const shippingLabels = {
  PENDING: "대기",
  PREPARING: "발송준비",
  SHIPPED: "출고완료",
  PARTIAL: "부분출고",
} as const;

export default function OrdersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = ["MASTER", "SUB_MASTER", "ADMIN"].includes(userRole);

  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);
  const [orderTypeTab, setOrderTypeTab] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const extraParams = orderTypeTab !== "all" ? { productType: orderTypeTab } : undefined;
  const { dataSource, refresh } = useApiCrud<Order>("/api/orders", extraParams);

  const handleConfirmPayment = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("입금확인 하시겠습니까? WMS 주문이 자동 생성됩니다.")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-payment`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("입금이 확인되었습니다.");
        refresh();
      } else {
        toast.error(data.error?.message || "입금확인 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("발주를 취소하시겠습니까? 선점된 재고가 해제됩니다.")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("발주가 취소되었습니다.");
        refresh();
      } else {
        toast.error(data.error?.message || "취소 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "orderNo",
      header: "주문번호",
    },
    {
      accessorKey: "seller",
      header: "판매자",
      cell: ({ row }) => row.original.seller?.name ?? "-",
    },
    {
      accessorKey: "paymentStatus",
      header: "입금상태",
      cell: ({ row }) => {
        const paymentStatus = row.original.paymentStatus;
        return (
          <Badge variant="outline" className={paymentColors[paymentStatus]}>
            {paymentLabels[paymentStatus]}
          </Badge>
        );
      },
    },
    {
      id: "expiryTimer",
      header: "남은시간",
      cell: ({ row }) => (
        <ExpiryTimer
          expiresAt={row.original.expiresAt}
          status={row.original.status}
          paymentStatus={row.original.paymentStatus}
        />
      ),
    },
    {
      accessorKey: "shippingStatus",
      header: "출고상태",
      cell: ({ row }) => {
        const shippingStatus = row.original.shippingStatus;
        return (
          <Badge variant="outline" className={shippingColors[shippingStatus]}>
            {shippingLabels[shippingStatus]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "승인상태",
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
      accessorKey: "totalAmount",
      header: "공급가합계",
      cell: ({ row }) => `${row.original.totalAmount.toLocaleString()}원`,
    },
    {
      accessorKey: "totalMargin",
      header: "마진",
      cell: ({ row }) => {
        const margin = (row.original as any).totalMargin;
        if (margin == null) return "-";
        return (
          <span className={margin > 0 ? "text-green-600 font-medium" : "text-red-600"}>
            {margin.toLocaleString()}원
          </span>
        );
      },
    },
    {
      accessorKey: "uploadedAt",
      header: "등록일",
      cell: ({ row }) =>
        new Date(row.original.uploadedAt).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "액션",
      cell: ({ row }) => {
        const order = row.original;
        const isLoading = actionLoading === order.id;
        const canConfirm =
          isAdmin &&
          order.status === "PENDING" &&
          order.paymentStatus === "UNPAID";
        const canCancel =
          order.status === "PENDING" && order.paymentStatus === "UNPAID";

        if (!canConfirm && !canCancel) return null;

        return (
          <div className="flex gap-1">
            {canConfirm && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                onClick={(e) => handleConfirmPayment(order.id, e)}
                disabled={isLoading}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                입금확인
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                onClick={(e) => handleCancel(order.id, e)}
                disabled={isLoading}
              >
                <XCircle className="h-3 w-3 mr-1" />
                취소
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const handleExportWMS = () => {
    window.open("/api/orders/export?type=wms", "_blank");
  };

  const handleExportCenter = () => {
    window.open("/api/orders/export?type=center", "_blank");
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">발주 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportWMS}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            슈퍼무진 주문서
          </Button>
          <Button variant="outline" onClick={handleExportCenter}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            자사몰 주문서
          </Button>
          <Link href="/orders/upload">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              엑셀 업로드
            </Button>
          </Link>
          <Link href="/orders/upload">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              신규 발주
            </Button>
          </Link>
        </div>
      </div>

      {/* 발주서 유형 탭 (PDF p6 스펙) */}
      <Tabs value={orderTypeTab} onValueChange={setOrderTypeTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="HEADQUARTERS">업체발주서</TabsTrigger>
          <TabsTrigger value="CENTER">관리메이트</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 파이프라인 요약 카드 */}
      <OrderPipelineCards
        onFilterChange={setPipelineFilter}
        activeFilter={pipelineFilter}
      />

      <DataTable
        columns={columns}
        dataSource={dataSource}
        enableRowSelection={true}
      />
    </div>
  );
}
