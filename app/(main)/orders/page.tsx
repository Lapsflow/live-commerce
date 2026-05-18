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
  FileText,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import OrderPipelineCards from "./components/OrderPipelineCards";
import ExpiryTimer from "./components/ExpiryTimer";
import { getOrderStatusLabel, getOrderStatusColor } from "@/lib/utils/order-status-label";
import {
  PAYMENT_STATUS_LABELS,
  SHIPPING_STATUS_LABELS,
  paymentStatusVariant,
  shippingStatusVariant,
} from "@/lib/constants/order-labels";
import type { PaymentStatus, ShippingStatus } from "@/types/order";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const statusColors = {
  PENDING: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  APPROVED: "bg-green-500/10 text-green-700 dark:text-green-400",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-400",
} as const;

const statusLabels = {
  PENDING: "발주요청",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELLED: "취소",
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
  PREPARING: "배송준비중",
  SHIPPED: "배송완료",
  PARTIAL: "부분출고",
} as const;

export default function OrdersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = ["MASTER", "SUB_MASTER"].includes(userRole);
  const isSubMaster = userRole === "SUB_MASTER";
  const isSeller = userRole === "SELLER";

  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);
  const [orderTypeTab, setOrderTypeTab] = useState<string>(isSubMaster ? "HEADQUARTERS" : "all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const extraParams = orderTypeTab !== "all" ? { productType: orderTypeTab } : undefined;
  const { dataSource, refresh } = useApiCrud<Order>("/api/orders", extraParams);

  const handleConfirm = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("이 발주를 컨펌하시겠습니까?")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("발주가 컨펌되었습니다.");
        refresh();
      } else {
        toast.error(data.error?.message || "컨펌 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectOrderId || !rejectReason.trim()) return;

    setActionLoading(rejectOrderId);
    try {
      const res = await fetch(`/api/orders/${rejectOrderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("발주가 반려되었습니다.");
        refresh();
      } else {
        toast.error(data.error?.message || "반려 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
      setRejectDialogOpen(false);
      setRejectOrderId(null);
      setRejectReason("");
    }
  };

  const handleConfirmPayment = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("입금확인 하시겠습니까?")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-confirm`, {
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

  const handleShip = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("출고 처리하시겠습니까?")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingStatus: "SHIPPED" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("출고 처리되었습니다.");
        refresh();
      } else {
        toast.error(data.error?.message || "출고 처리 실패");
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
      accessorKey: "seller.center.name",
      header: "센터명",
      cell: ({ row }) => row.original.seller?.center?.name ?? "-",
    },
    {
      accessorKey: "seller.name",
      header: "셀러명",
      cell: ({ row }) => row.original.seller?.name ?? "-",
    },
    {
      accessorKey: "paymentStatus",
      header: "입금상태",
      cell: ({ row }) => {
        const status = row.original.paymentStatus as PaymentStatus;
        return (
          <Badge variant={paymentStatusVariant(status)}>
            {PAYMENT_STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "shippingStatus",
      header: "출고상태",
      cell: ({ row }) => {
        const status = row.original.shippingStatus as ShippingStatus;
        return (
          <Badge variant={shippingStatusVariant(status)}>
            {SHIPPING_STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "등록일",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return date.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    {
      id: "actions",
      header: "액션",
      cell: ({ row }) => {
        const order = row.original;
        const isLoading = actionLoading === order.id;
        // SUB_MASTER HEADQUARTERS tab = read-only
        const isReadOnly = isSubMaster && orderTypeTab === "HEADQUARTERS";
        if (isReadOnly) return null;

        const canApprove = isAdmin && order.status === "PENDING";
        const canPaymentConfirm = isAdmin && order.status === "APPROVED" && order.paymentStatus === "UNPAID";
        const canShip = isAdmin && order.status === "APPROVED" && order.paymentStatus === "PAID" && order.shippingStatus === "PENDING";
        const canCancel = order.status === "PENDING" && order.paymentStatus === "UNPAID";

        if (!canApprove && !canPaymentConfirm && !canShip && !canCancel) return null;

        return (
          <div className="flex gap-1 flex-wrap">
            {canApprove && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                  onClick={(e) => handleConfirm(order.id, e)}
                  disabled={isLoading}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  컨펌
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectOrderId(order.id);
                    setRejectReason("");
                    setRejectDialogOpen(true);
                  }}
                  disabled={isLoading}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  반려
                </Button>
              </>
            )}
            {canPaymentConfirm && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                onClick={(e) => handleConfirmPayment(order.id, e)}
                disabled={isLoading}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                입금확인
              </Button>
            )}
            {canShip && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                onClick={(e) => handleShip(order.id, e)}
                disabled={isLoading}
              >
                <Truck className="h-3 w-3 mr-1" />
                출고
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
        <h1 className="text-3xl font-bold">
          {isSeller ? "내 발주" : isSubMaster ? "발주 컨펌" : "발주 관리"}
        </h1>
        <div className="flex gap-2">
          {!isSeller && (
            <>
              <Link href="/orders/manual" target="_blank">
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  발주 매뉴얼
                </Button>
              </Link>
              <Button variant="outline" onClick={handleExportWMS}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                슈퍼무진 주문서
              </Button>
              <Button variant="outline" onClick={handleExportCenter}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                자사몰 주문서
              </Button>
            </>
          )}
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

      {/* 발주서 유형 탭 */}
      <Tabs value={orderTypeTab} onValueChange={setOrderTypeTab} className="mb-4">
        <TabsList>
          {isSubMaster ? (
            <>
              <TabsTrigger value="HEADQUARTERS">본사 제품 발주</TabsTrigger>
              <TabsTrigger value="CENTER">센터 제품 발주</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="HEADQUARTERS">업체발주서 (본사 책임)</TabsTrigger>
              <TabsTrigger value="CENTER">관리메이트 (센터 책임)</TabsTrigger>
            </>
          )}
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

      {/* 반려 사유 입력 모달 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>발주 반려</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="반려 사유를 입력해주세요"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || actionLoading !== null}
            >
              반려 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
