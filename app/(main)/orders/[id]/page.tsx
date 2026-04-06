"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Truck, CreditCard } from "lucide-react";

type OrderItem = {
  id: string;
  barcode: string;
  productName: string;
  quantity: number;
  supplyPrice: number;
  totalSupply: number;
  margin: number;
  product: {
    id: string;
    code: string;
    name: string;
    barcode: string;
    sellPrice: number;
    supplyPrice: number;
  };
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  totalAmount: number;
  totalMargin: number;
  recipient: string | null;
  phone: string | null;
  address: string | null;
  memo: string | null;
  uploadedAt: string;
  seller: {
    id: string;
    name: string;
    email: string;
  };
  admin: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: OrderItem[];
};

const statusLabels: Record<string, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "거절",
};

const paymentStatusLabels: Record<string, string> = {
  UNPAID: "입금확인전",
  PAID: "입금완료",
};

const shippingStatusLabels: Record<string, string> = {
  PENDING: "대기",
  PREPARING: "발송준비",
  SHIPPED: "출고완료",
  PARTIAL: "부분출고",
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrderDetail();
  }, [orderId]);

  const loadOrderDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();

      if (res.ok && data.data) {
        setOrder(data.data);
      } else {
        setError(data.error?.message || "발주를 불러올 수 없습니다");
      }
    } catch (err) {
      console.error("Error loading order:", err);
      setError("발주를 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => router.push("/orders")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          발주 목록으로
        </Button>
        <Card className="p-6">
          <div className="text-red-600">{error || "발주를 찾을 수 없습니다"}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/orders")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            목록
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">발주 상세</h1>
        </div>
      </div>

      {/* Order Info Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">발주 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">발주 번호</p>
            <p className="font-medium text-gray-900">{order.orderNo}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">셀러</p>
            <p className="font-medium text-gray-900">{order.seller.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">상태</p>
            <span className="inline-block px-2 py-1 text-sm rounded-md bg-gray-100 text-gray-800">
              {statusLabels[order.status]}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              <CreditCard className="h-4 w-4 inline mr-1" />
              입금 상태
            </p>
            <span
              className={`inline-block px-2 py-1 text-sm rounded-md ${
                order.paymentStatus === "PAID"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {paymentStatusLabels[order.paymentStatus]}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              <Truck className="h-4 w-4 inline mr-1" />
              출고 상태
            </p>
            <span
              className={`inline-block px-2 py-1 text-sm rounded-md ${
                order.shippingStatus === "SHIPPED"
                  ? "bg-green-100 text-green-800"
                  : order.shippingStatus === "PREPARING"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {shippingStatusLabels[order.shippingStatus]}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">등록일</p>
            <p className="font-medium text-gray-900">
              {new Date(order.uploadedAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </div>
      </Card>

      {/* Recipient Info Card */}
      {(order.recipient || order.phone || order.address) && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">수령자 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {order.recipient && (
              <div>
                <p className="text-sm text-gray-600">수령자</p>
                <p className="font-medium text-gray-900">{order.recipient}</p>
              </div>
            )}
            {order.phone && (
              <div>
                <p className="text-sm text-gray-600">연락처</p>
                <p className="font-medium text-gray-900">{order.phone}</p>
              </div>
            )}
            {order.address && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">주소</p>
                <p className="font-medium text-gray-900">{order.address}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Order Items Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          <Package className="h-5 w-5 inline mr-2" />
          발주 항목
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  바코드
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상품명
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  수량
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  공급가
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  공급가 합계
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  마진
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.barcode}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.productName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {item.supplyPrice.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {item.totalSupply.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {item.margin.toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 text-right">
                  합계
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {order.totalAmount.toLocaleString()}원
                </td>
                <td className="px-4 py-3 text-sm text-blue-600 text-right">
                  {order.totalMargin.toLocaleString()}원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Memo Card */}
      {order.memo && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">메모</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{order.memo}</p>
        </Card>
      )}
    </div>
  );
}
