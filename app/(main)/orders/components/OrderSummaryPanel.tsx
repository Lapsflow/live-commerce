"use client";

/**
 * 발주 현황 요약 패널 (2026-07-10, 한국무진 요청 1번)
 * - 상단 KPI: 전체 발주금액 / 발주건수 / 상품수량(EA) / 미입금액
 * - showSellers: 셀러별 현황 테이블 (발주건수/금액/EA/입금/미입금/입금상태)
 * 데이터: /api/orders/summary (승인·요청 상태 발주, 발주일 기준 기간 필터)
 */

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, DollarSign, FileText, Package, AlertCircle } from "lucide-react";
import { SELLER_PAYMENT_METHOD_LABELS } from "@/lib/constants/order-labels";

interface SellerSummary {
  sellerId: string;
  sellerName: string;
  centerName: string | null;
  paymentMethod: string;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  totalQty: number;
  paymentState: "완납" | "일부입금" | "미입금";
}

interface SummaryData {
  totals: {
    orderCount: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    totalQty: number;
  };
  bySeller: SellerSummary[];
}

interface OrderSummaryPanelProps {
  fromDate: string;
  toDate: string;
  productType: string | null;
  showSellers: boolean;
  /** 값이 바뀔 때마다 재조회 (입금확인 등 액션 후 갱신용) */
  refreshSignal?: number;
  onSellerClick?: (sellerId: string, sellerName: string) => void;
}

const stateVariant = (state: SellerSummary["paymentState"]) =>
  state === "완납" ? "default" : state === "일부입금" ? "secondary" : "destructive";

export default function OrderSummaryPanel({
  fromDate,
  toDate,
  productType,
  showSellers,
  refreshSignal = 0,
  onSellerClick,
}: OrderSummaryPanelProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (productType) params.set("productType", productType);
      const res = await fetch(`/api/orders/summary?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json.data);
    } catch {
      // 요약 실패는 목록 표시를 막지 않음
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, productType]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshSignal]);

  const totals = data?.totals;

  // 셀러별 현황 CSV 다운로드 (클라이언트 생성, BOM 포함)
  const handleDownloadCsv = () => {
    if (!data) return;
    const header = "셀러명,센터,결제방식,발주건수,발주금액,수량EA,입금금액,미입금금액,입금상태\n";
    const rows = data.bySeller
      .map((s) =>
        [
          `"${s.sellerName}"`,
          `"${s.centerName ?? ""}"`,
          SELLER_PAYMENT_METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod,
          s.orderCount,
          s.totalAmount,
          s.totalQty,
          s.paidAmount,
          s.unpaidAmount,
          s.paymentState,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `셀러별_발주현황_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    {
      label: "전체 발주금액",
      value: totals ? `${totals.totalAmount.toLocaleString()}원` : "-",
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "전체 발주건수",
      value: totals ? `${totals.orderCount.toLocaleString()}건` : "-",
      icon: FileText,
      color: "text-grey-700",
      bg: "bg-grey-50",
    },
    {
      label: "상품 수량(EA)",
      value: totals ? `${totals.totalQty.toLocaleString()}개` : "-",
      icon: Package,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "미입금액",
      value: totals ? `${totals.unpaidAmount.toLocaleString()}원` : "-",
      icon: AlertCircle,
      color: totals && totals.unpaidAmount > 0 ? "text-red-600" : "text-grey-400",
      bg: totals && totals.unpaidAmount > 0 ? "bg-red-50" : "bg-grey-50",
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* KPI 카드 */}
      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-grey-500">{kpi.label}</p>
                    <p className="text-xl font-bold text-grey-900 truncate">{kpi.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 셀러별 현황 */}
      {showSellers && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">셀러별 발주 현황</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={!data || data.bySeller.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV 다운로드
            </Button>
          </div>

          {loading && !data ? (
            <Skeleton className="h-48 w-full" />
          ) : !data || data.bySeller.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              해당 기간에 발주가 없습니다
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">셀러명</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">센터</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">결제방식</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">발주건수</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">발주금액</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">수량(EA)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">입금금액</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">미입금금액</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">입금상태</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySeller.map((s) => (
                    <tr
                      key={s.sellerId}
                      className={`border-b last:border-0 hover:bg-muted/30 ${onSellerClick ? "cursor-pointer" : ""}`}
                      onClick={() => onSellerClick?.(s.sellerId, s.sellerName)}
                    >
                      <td className="px-3 py-2 font-medium">{s.sellerName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.centerName ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {SELLER_PAYMENT_METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod}
                      </td>
                      <td className="px-3 py-2 text-right">{s.orderCount.toLocaleString()}건</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {s.totalAmount.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 text-right">{s.totalQty.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-green-700">
                        {s.paidAmount.toLocaleString()}원
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${s.unpaidAmount > 0 ? "text-red-600" : "text-grey-400"}`}
                      >
                        {s.unpaidAmount.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={stateVariant(s.paymentState)}>{s.paymentState}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
