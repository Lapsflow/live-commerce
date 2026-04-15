"use client";

import { DataTable } from "@/components/ui/data-table/data-table";
import { useApiCrud } from "@/hooks/use-api-crud";
import type { Product } from "@/types/product";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import Link from "next/link";
import { StockSyncButton } from "./components/stock-sync-button";

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "code",
    header: "상품코드",
  },
  {
    accessorKey: "name",
    header: "상품명",
  },
  {
    accessorKey: "barcode",
    header: "바코드",
  },
  {
    accessorKey: "productType",
    header: "상품 유형",
    cell: ({ row }) => {
      const type = row.original.productType;
      return (
        <Badge
          variant="outline"
          className={
            type === "HEADQUARTERS"
              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
              : "bg-purple-500/10 text-purple-700 dark:text-purple-400"
          }
        >
          {type === "HEADQUARTERS" ? "본사 WMS" : "센터 자사몰"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "sellPrice",
    header: "판매가",
    cell: ({ row }) => `${row.original.sellPrice.toLocaleString()}원`,
  },
  {
    accessorKey: "totalStock",
    header: "총 재고",
    cell: ({ row }) => {
      const stock = row.original.totalStock;
      const isLowStock = stock < 10;
      return (
        <Badge
          variant="outline"
          className={
            isLowStock
              ? "bg-red-500/10 text-red-700 dark:text-red-400"
              : "bg-green-500/10 text-green-700 dark:text-green-400"
          }
        >
          {stock}개
        </Badge>
      );
    },
  },
  {
    id: "onewms-sync",
    header: "ONEWMS 동기화",
    cell: ({ row }) => {
      return <StockSyncButton productId={row.original.id} />;
    },
  },
  {
    id: "actions",
    header: "작업",
    cell: ({ row }) => (
      <Link href={`/products/${row.original.id}`}>
        <Button variant="ghost" size="sm">
          상세보기
        </Button>
      </Link>
    ),
  },
];

export default function ProductsPage() {
  const { dataSource, refresh } = useApiCrud<Product>("/api/products");

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">상품 관리</h1>
          <p className="text-muted-foreground">
            상품 목록 및 ONEWMS 재고 동기화
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              상품 추가
            </Button>
          </Link>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        dataSource={dataSource}
        title="상품 목록"
        searchPlaceholder="상품명 또는 바코드 검색..."
      />
    </div>
  );
}
