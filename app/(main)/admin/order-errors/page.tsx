"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type OrderError = {
  id: string;
  orderNumber: string;
  centerName: string;
  sellerName: string;
  productName: string;
  errorType: "매칭실패" | "재고부족";
  message: string;
  createdAt: string;
  sellerPhone: string;
};

const pageSize = 50;

export default function OrderErrorsPage() {
  const [items, setItems] = useState<OrderError[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/order-errors?pageIndex=${page}&pageSize=${pageSize}`
      );
      const data = await res.json();
      if (res.ok && data.data) {
        setItems(data.data.items || []);
        setTotal(data.data.totalCount || 0);
      } else {
        toast.error(data.error?.message || "오류 목록을 불러올 수 없습니다");
      }
    } catch {
      toast.error("오류 목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    fetchErrors(0);
  }

  const totalPages = Math.ceil(total / pageSize);
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-grey-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertCircle className="h-8 w-8 text-red-600" />
        <h1 className="text-3xl font-bold text-grey-900">발주 오류</h1>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-6">
          {items.length === 0 ? (
            <div className="text-center py-8 text-grey-500">
              오류 데이터가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-grey-200">
                <thead>
                  <tr className="bg-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      주문번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      센터명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      셀러명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      상품명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      오류유형
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      메시지
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">
                      발생시각
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-grey-50">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">
                        {item.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {item.centerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {item.sellerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {item.productName}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            item.errorType === "매칭실패"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {item.errorType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600 max-w-xs truncate">
                        {item.message}
                      </td>
                      <td className="px-4 py-3 text-sm text-grey-600">
                        {new Date(item.createdAt).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.sellerPhone ? (
                          <a
                            href={`tel:${item.sellerPhone}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Phone className="h-4 w-4" />
                            <span className="text-sm">연락</span>
                          </a>
                        ) : (
                          <span className="text-grey-400 text-xs">
                            연락처 없음
                          </span>
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
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newPage = Math.max(0, pageIndex - 1);
              setPageIndex(newPage);
              fetchErrors(newPage);
            }}
            disabled={!canPrev}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>

          <span className="text-sm text-grey-600">
            페이지 {pageIndex + 1} / {Math.max(1, totalPages)} (총{" "}
            {total}건)
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newPage = Math.min(totalPages - 1, pageIndex + 1);
              setPageIndex(newPage);
              fetchErrors(newPage);
            }}
            disabled={!canNext}
            className="flex items-center gap-1"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
