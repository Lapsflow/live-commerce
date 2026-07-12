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
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import OrderPipelineCards from "./components/OrderPipelineCards";
import OrderSummaryPanel from "./components/OrderSummaryPanel";
import ExpiryTimer from "./components/ExpiryTimer";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const isMaster = userRole === "MASTER";

  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);
  const [orderTypeTab, setOrderTypeTab] = useState<string>(isSubMaster ? "HEADQUARTERS" : "all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ─── 발주관리 개선 (2026-07-10, 한국무진 요청 1·2·4번) ───
  // 뷰 탭(목록/셀러별), 기간(발주일 기준, 기본 이번 달), 입금·출고상태 필터
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().split("T")[0];

  const [viewTab, setViewTab] = useState<"list" | "sellers">("list");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(todayStr);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [shippingFilter, setShippingFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState<{ id: string; name: string } | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // 파이프라인 카드 클릭 → 필터 매핑 (기존엔 state 만 바뀌고 목록에 미적용되던 死배선 수정)
  const pipelineParams: Record<string, Record<string, string>> = {
    pendingUnpaid: { status: "PENDING", paymentStatus: "UNPAID" },
    approvedPreparing: { status: "APPROVED", paymentStatus: "PAID" },
    shipped: { shippingStatus: "SHIPPED" },
    rejected: { status: "REJECTED" },
  };

  const extraParams: Record<string, string> = {
    ...(orderTypeTab !== "all" && { productType: orderTypeTab }),
    ...(fromDate && { fromDate }),
    ...(toDate && { toDate }),
    ...(paymentFilter !== "all" && { paymentStatus: paymentFilter }),
    ...(shippingFilter !== "all" && { shippingStatus: shippingFilter }),
    ...(sellerFilter && { sellerId: sellerFilter.id }),
    ...(pipelineFilter ? pipelineParams[pipelineFilter] : {}),
  };
  const { dataSource, refresh } = useApiCrud<Order>("/api/orders", extraParams);

  /** 목록 + 요약 동시 갱신 (입금확인 등 액션 후) */
  const refreshAll = () => {
    refresh();
    setRefreshSignal((s) => s + 1);
  };

  // 기간 프리셋
  const setThisMonth = () => {
    setFromDate(monthStart);
    setToDate(todayStr);
  };
  const setLastMonth = () => {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setFromDate(fmt(first));
    setToDate(fmt(last));
  };
  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setPaymentFilter("all");
    setShippingFilter("all");
    setSellerFilter(null);
    setPipelineFilter(null);
  };

  // 엑셀 다운로드 — 현재 필터 그대로 (요청 2번)
  const handleExportFiltered = () => {
    const params = new URLSearchParams(extraParams);
    window.open(`/api/orders/export?${params.toString()}`, "_blank");
  };

  /**
   * 발주 영구 삭제 (MASTER 전용)
   * 테스트 데이터 정리 목적. cascade 로 OrderItem, OnewmsOrderMapping, Payment 등 함께 삭제.
   */
  const handleDeleteOrder = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    const orderNo = order.orderNo || order.id.slice(0, 8);
    const sellerName = order.seller?.name || "-";
    if (!confirm(
      `발주를 영구 삭제하시겠습니까?\n\n` +
      `발주번호: ${orderNo}\n` +
      `셀러: ${sellerName}\n` +
      `상태: ${order.status} / ${order.paymentStatus} / ${order.shippingStatus}\n\n` +
      `⚠️ 이 작업은 되돌릴 수 없습니다.\n` +
      `발주 항목·결제·ONEWMS 매핑도 함께 삭제됩니다.`
    )) return;

    setActionLoading(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`발주 ${orderNo} 삭제 완료`);
        refreshAll();
      } else {
        toast.error(data.error?.message || "삭제 실패");
      }
    } catch {
      toast.error("서버 오류");
    } finally {
      setActionLoading(null);
    }
  };

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
        refreshAll();
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
        refreshAll();
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
        refreshAll();
      } else {
        toast.error(data.error?.message || "입금확인 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  // 발주관리 개선(2026-07-10): 입금 보류 지정/해제
  const handleHold = async (orderId: string, hold: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(hold ? "이 발주를 입금 보류로 지정하시겠습니까?" : "보류를 해제하시겠습니까?")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hold }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(hold ? "보류로 지정되었습니다." : "보류가 해제되었습니다.");
        refreshAll();
      } else {
        toast.error(data.error?.message || "처리 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  // PDF §5: UNPAID → PENDING_CONFIRMATION (입금 확인 중)
  const handlePaymentPending = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("입금 확인 중으로 변경하시겠습니까?\n(은행 입금 내역을 확인했으나 최종 검증 전 단계)")) return;

    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-pending`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("입금 확인 중으로 변경되었습니다.");
        refreshAll();
      } else {
        toast.error(data.error?.message || "상태 변경 실패");
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
        refreshAll();
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
        refreshAll();
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
        // PDF §5 3단계 입금 흐름: UNPAID → PENDING_CONFIRMATION → PAID (+ ON_HOLD 보류)
        const canMarkPending = isAdmin && order.status === "APPROVED" && order.paymentStatus === "UNPAID";
        const canPaymentConfirm = isAdmin && order.status === "APPROVED" &&
          (order.paymentStatus === "UNPAID" || order.paymentStatus === "PENDING_CONFIRMATION" ||
            order.paymentStatus === "ON_HOLD");
        const canHold = isAdmin && order.status === "APPROVED" &&
          (order.paymentStatus === "UNPAID" || order.paymentStatus === "PENDING_CONFIRMATION");
        const canUnhold = isAdmin && order.paymentStatus === "ON_HOLD";
        const canShip = isAdmin && order.status === "APPROVED" && order.paymentStatus === "PAID" && order.shippingStatus === "PENDING";
        const canCancel = order.status === "PENDING" && order.paymentStatus === "UNPAID";
        // MASTER 전용 영구 삭제 — 테스트 데이터 정리 목적. 모든 상태에서 삭제 가능.
        const canDelete = isMaster;

        if (!canApprove && !canMarkPending && !canPaymentConfirm && !canShip && !canCancel && !canDelete) return null;

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
            {canMarkPending && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={(e) => handlePaymentPending(order.id, e)}
                disabled={isLoading}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                입금확인중
              </Button>
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
                입금완료
              </Button>
            )}
            {canHold && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                onClick={(e) => handleHold(order.id, true, e)}
                disabled={isLoading}
              >
                보류
              </Button>
            )}
            {canUnhold && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                onClick={(e) => handleHold(order.id, false, e)}
                disabled={isLoading}
              >
                보류해제
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
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                onClick={(e) => handleDeleteOrder(order, e)}
                disabled={isLoading}
                title="영구 삭제 (테스트 데이터 정리)"
              >
                <Trash2 className="h-3 w-3" />
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

      {/* 기간 · 상태 필터 (요청 4번 — 발주일 기준)
          스타일: DateRangePicker 프리셋 버튼(최근 7일 등)과 동일 라인·동일 톤으로 통일 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DateRangePicker fromDate={fromDate} toDate={toDate} onDateChange={(f, t) => { setFromDate(f); setToDate(t); }} />
        <button
          onClick={setThisMonth}
          className="px-3 py-2 text-sm border border-grey-300 rounded-md hover:bg-grey-50 transition-colors"
        >
          이번 달
        </button>
        <button
          onClick={setLastMonth}
          className="px-3 py-2 text-sm border border-grey-300 rounded-md hover:bg-grey-50 transition-colors"
        >
          지난 달
        </button>
        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v ?? "all")}>
          <SelectTrigger className="h-[38px] rounded-md border-grey-300 px-3">
            {/* base-ui SelectValue 는 원시 값("all")을 그대로 노출 → 라벨 직접 렌더 */}
            <span className={paymentFilter === "all" ? "text-grey-500" : ""}>
              {paymentFilter === "all"
                ? "입금상태 전체"
                : PAYMENT_STATUS_LABELS[paymentFilter as PaymentStatus]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">입금상태 전체</SelectItem>
            <SelectItem value="UNPAID">입금확인전</SelectItem>
            <SelectItem value="PENDING_CONFIRMATION">입금확인중</SelectItem>
            <SelectItem value="PAID">입금완료</SelectItem>
            <SelectItem value="ON_HOLD">보류</SelectItem>
          </SelectContent>
        </Select>
        <Select value={shippingFilter} onValueChange={(v) => setShippingFilter(v ?? "all")}>
          <SelectTrigger className="h-[38px] rounded-md border-grey-300 px-3">
            <span className={shippingFilter === "all" ? "text-grey-500" : ""}>
              {shippingFilter === "all"
                ? "출고상태 전체"
                : SHIPPING_STATUS_LABELS[shippingFilter as ShippingStatus]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">출고상태 전체</SelectItem>
            <SelectItem value="PENDING">배송대기</SelectItem>
            <SelectItem value="PREPARING">배송준비중</SelectItem>
            <SelectItem value="SHIPPED">배송중</SelectItem>
            <SelectItem value="DELIVERED">배송완료</SelectItem>
            <SelectItem value="PARTIAL">부분배송</SelectItem>
          </SelectContent>
        </Select>
        {sellerFilter && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => setSellerFilter(null)}>
            셀러: {sellerFilter.name} ✕
          </Badge>
        )}
        <button
          onClick={clearFilters}
          className="px-3 py-2 text-sm text-grey-500 rounded-md hover:bg-grey-50 transition-colors"
        >
          필터 초기화
        </button>
        {!isSeller && (
          <button
            onClick={handleExportFiltered}
            className="ml-auto px-3 py-2 text-sm border border-grey-300 rounded-md hover:bg-grey-50 transition-colors inline-flex items-center"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            발주내역 다운로드
          </button>
        )}
      </div>

      {/* 전체 현황 KPI (요청 1-1) + 셀러별 현황 (요청 1-2) */}
      <OrderSummaryPanel
        fromDate={fromDate}
        toDate={toDate}
        productType={orderTypeTab !== "all" ? orderTypeTab : null}
        showSellers={viewTab === "sellers"}
        refreshSignal={refreshSignal}
        onSellerClick={(id, name) => {
          setSellerFilter({ id, name });
          setViewTab("list");
        }}
      />

      {/* 목록 / 셀러별 현황 뷰 전환 */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as "list" | "sellers")} className="mb-4">
        <TabsList>
          <TabsTrigger value="list">발주 목록</TabsTrigger>
          <TabsTrigger value="sellers">셀러별 현황</TabsTrigger>
        </TabsList>
      </Tabs>

      {viewTab === "list" && (
        <>
          {/* 파이프라인 요약 카드 (클릭 시 목록 필터 적용) */}
          <OrderPipelineCards
            onFilterChange={setPipelineFilter}
            activeFilter={pipelineFilter}
          />

          <DataTable
            columns={columns}
            dataSource={dataSource}
            enableRowSelection={true}
          />
        </>
      )}

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
