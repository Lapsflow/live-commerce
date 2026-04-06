"use client";

import { DataTable } from "@/components/ui/data-table/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useApiCrud } from "@/hooks/use-api-crud";
import type { Order } from "@/types/order";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import Link from "next/link";

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
  PENDING: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
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
    header: "총금액",
    cell: ({ row }) => `${row.original.totalAmount.toLocaleString()}원`,
  },
  {
    accessorKey: "uploadedAt",
    header: "등록일",
    cell: ({ row }) => new Date(row.original.uploadedAt).toLocaleDateString(),
  },
];

export default function OrdersPage() {
  const { dataSource } = useApiCrud<Order>("/api/orders");

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">발주 관리</h1>
        <div className="flex gap-2">
          <Link href="/orders/upload">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              엑셀 업로드
            </Button>
          </Link>
          <Link href="/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              신규 발주
            </Button>
          </Link>
        </div>
      </div>

      <DataTable columns={columns} dataSource={dataSource} enableRowSelection={true} />
    </div>
  );
}
