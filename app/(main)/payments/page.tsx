"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getOrderStatusLabel, getOrderStatusColor } from "@/lib/utils/order-status-label";

interface PaymentOrder {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  totalAmount: number;
  paidAt: string | null;
  uploadedAt: string;
  seller: { id: string; name: string };
}

type FilterTab = "all" | "UNPAID" | "PAID";

export default function PaymentsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;

  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("UNPAID");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch APPROVED orders (confirmed orders that need payment tracking)
      // 2026-07-10 수정: 기존 limit 파라미터는 API 가 읽지 않아 무시되고,
      // status/paymentStatus 필터도 서버 미지원이라 탭이 안 먹던 버그 — API 필터
      // 확장과 함께 pageSize(상한 100) 로 정합.
      const params = new URLSearchParams({ status: "APPROVED", pageSize: "100" });
      if (filterTab !== "all") {
        params.set("paymentStatus", filterTab);
      }
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setOrders(json.data);
      }
    } catch {
      toast.error("발주 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [filterTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (userRole !== "MASTER" && userRole !== "SUB_MASTER") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-red-600">접근 권한이 없습니다</div>
        </Card>
      </div>
    );
  }

  const unpaidOrders = orders.filter((o) => o.paymentStatus === "UNPAID");
  const totalUnpaid = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === unpaidOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidOrders.map((o) => o.id)));
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("입금확인 완료");
        fetchOrders();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      } else {
        toast.error(data.error?.message || "입금확인 실패");
      }
    } catch {
      toast.error("서버 오류");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}건을 일괄 입금확인 하시겠습니까?`)) return;

    setActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/orders/${id}/payment-confirm`, {
          method: "POST",
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) toast.success(`${successCount}건 입금확인 완료`);
    if (failCount > 0) toast.error(`${failCount}건 실패`);
    setSelectedIds(new Set());
    fetchOrders();
    setActionLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">입금 관리</h1>
        </div>
        {selectedIds.size > 0 && (
          <Button onClick={handleBulkConfirm} disabled={actionLoading}>
            {actionLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {selectedIds.size}건 일괄 입금확인
          </Button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">미입금 건수</p>
          <p className="text-2xl font-bold text-yellow-600">{unpaidOrders.length}건</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">미입금 총액</p>
          <p className="text-2xl font-bold text-yellow-600">{totalUnpaid.toLocaleString()}원</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">입금완료</p>
          <p className="text-2xl font-bold text-green-600">
            {orders.filter((o) => o.paymentStatus === "PAID").length}건
          </p>
        </Card>
      </div>

      {/* 필터 탭 */}
      <Tabs value={filterTab} onValueChange={(v) => { setFilterTab(v as FilterTab); setSelectedIds(new Set()); }}>
        <TabsList>
          <TabsTrigger value="UNPAID">미입금</TabsTrigger>
          <TabsTrigger value="PAID">입금완료</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 발주 목록 */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {filterTab === "UNPAID" ? "미입금 발주가 없습니다" : "발주가 없습니다"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {filterTab === "UNPAID" && (
                    <th className="p-3 w-10">
                      <Checkbox
                        checked={selectedIds.size === unpaidOrders.length && unpaidOrders.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                  )}
                  <th className="p-3 text-left">주문번호</th>
                  <th className="p-3 text-left">판매자</th>
                  <th className="p-3 text-left">발주상태</th>
                  <th className="p-3 text-right">금액</th>
                  <th className="p-3 text-left">등록일</th>
                  <th className="p-3 text-left">입금일</th>
                  {filterTab === "UNPAID" && <th className="p-3 text-center">액션</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const label = getOrderStatusLabel({
                    status: order.status as any,
                    paymentStatus: order.paymentStatus as any,
                    shippingStatus: order.shippingStatus as any,
                  });
                  const colorClass = getOrderStatusColor(label);
                  return (
                    <tr key={order.id} className="border-b hover:bg-muted/30">
                      {filterTab === "UNPAID" && (
                        <td className="p-3">
                          {order.paymentStatus === "UNPAID" && (
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => toggleSelect(order.id)}
                            />
                          )}
                        </td>
                      )}
                      <td className="p-3 font-mono text-xs">{order.orderNo}</td>
                      <td className="p-3">{order.seller?.name || "-"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={colorClass}>
                          {label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{order.totalAmount.toLocaleString()}원</td>
                      <td className="p-3 text-xs">{new Date(order.uploadedAt).toLocaleDateString()}</td>
                      <td className="p-3 text-xs">
                        {order.paidAt ? new Date(order.paidAt).toLocaleDateString() : "-"}
                      </td>
                      {filterTab === "UNPAID" && (
                        <td className="p-3 text-center">
                          {order.paymentStatus === "UNPAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                              onClick={() => handleConfirmPayment(order.id)}
                              disabled={actionLoading}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              입금확인
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
