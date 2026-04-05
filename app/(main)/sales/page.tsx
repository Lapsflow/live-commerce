"use client";

import { DataTable } from "@/components/ui/data-table/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useApiCrud } from "@/hooks/use-api-crud";
import type { Sale } from "@/types/sale";
import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "@/components/ui/card";

const columns: ColumnDef<Sale>[] = [
  {
    accessorKey: "saleNo",
    header: "판매번호",
  },
  {
    accessorKey: "seller",
    header: "판매자",
    cell: ({ row }) => row.original.seller?.name ?? "-",
  },
  {
    accessorKey: "product",
    header: "상품",
    cell: ({ row }) => row.original.product?.name ?? "-",
  },
  {
    accessorKey: "broadcast",
    header: "방송",
    cell: ({ row }) => row.original.broadcast?.code ?? "-",
  },
  {
    accessorKey: "quantity",
    header: "수량",
    cell: ({ row }) => `${row.original.quantity.toLocaleString()}개`,
  },
  {
    accessorKey: "unitPrice",
    header: "단가",
    cell: ({ row }) => `${row.original.unitPrice.toLocaleString()}원`,
  },
  {
    accessorKey: "totalPrice",
    header: "총액",
    cell: ({ row }) => `${row.original.totalPrice.toLocaleString()}원`,
  },
  {
    accessorKey: "saleDate",
    header: "판매일",
    cell: ({ row }) => new Date(row.original.saleDate).toLocaleDateString(),
  },
];

export default function SalesPage() {
  const { dataSource } = useApiCrud<Sale>("/api/sales");

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">판매 현황</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">오늘 판매액</p>
          <p className="text-3xl font-bold">0원</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">이번 달 판매액</p>
          <p className="text-3xl font-bold">0원</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">총 판매건수</p>
          <p className="text-3xl font-bold">0건</p>
        </Card>
      </div>

      <DataTable columns={columns} dataSource={dataSource} enableRowSelection={false} />
    </div>
  );
}
