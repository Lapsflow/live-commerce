"use client";

import { DataTable } from "@/components/ui/data-table/data-table";
import { useApiCrud } from "@/hooks/use-api-crud";
import type { Product } from "@/types/product";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Package, FileSpreadsheet, RotateCcw, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { StockSyncButton } from "./components/stock-sync-button";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

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
    accessorKey: "isActive",
    header: "상태",
    cell: ({ row }) => {
      const active = row.original.isActive !== false;
      return (
        <Badge
          variant="outline"
          className={
            active
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-gray-500/10 text-gray-500 dark:text-gray-400"
          }
        >
          {active ? "���성" : "비활성"}
        </Badge>
      );
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
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userCenterId = (session?.user as any)?.centerId;
  const isMasterOrSub = ["MASTER", "SUB_MASTER"].includes(userRole);
  const isAdmin = userRole === "ADMIN";
  const isSeller = userRole === "SELLER";
  const canResetStock = isMasterOrSub || isAdmin;
  const canAddProduct = isMasterOrSub || isAdmin;
  const canUploadExcel = isMasterOrSub || isAdmin;

  const [productTypeFilter, setProductTypeFilter] = useState<"ALL" | "HEADQUARTERS" | "CENTER">("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [resetting, setResetting] = useState(false);

  const params = new URLSearchParams();
  if (productTypeFilter !== "ALL") params.set("productType", productTypeFilter);
  if (showInactive) params.set("showInactive", "true");
  const qs = params.toString();
  const apiPath = `/api/products${qs ? `?${qs}` : ""}`;
  const { dataSource, refresh } = useApiCrud<Product>(apiPath);

  const handleResetStock = async () => {
    if (!userCenterId) {
      toast.error("센터가 지정되지 않았습니다");
      return;
    }
    if (!confirm("해당 센터의 모든 상품 재고를 0으로 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

    setResetting(true);
    try {
      const res = await fetch("/api/products/reset-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: userCenterId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.data?.message || "재고가 초기화되었습니다");
        refresh();
      } else {
        toast.error(data.error?.message || "재고 초기화 실패");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    } finally {
      setResetting(false);
    }
  };

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
        {!isSeller && (
          <div className="flex gap-2">
            {canResetStock && userCenterId && (
              <Button
                variant="outline"
                onClick={handleResetStock}
                disabled={resetting}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {resetting ? "초기화 중..." : "재고 초기화"}
              </Button>
            )}
            {canUploadExcel && (
              <Link href="/products/upload">
                <Button variant="outline">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  엑셀 업로드
                </Button>
              </Link>
            )}
            {canAddProduct && (
              <>
                {isMasterOrSub && userRole === "MASTER" && (
                  <Link href="/products/new">
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      상품 추가
                    </Button>
                  </Link>
                )}
                <Link href="/products/center-new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    센터 상품 등록
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Product Type Filter */}
      <div className="flex gap-2 items-center">
        <Button
          variant={productTypeFilter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setProductTypeFilter("ALL")}
        >
          전체
        </Button>
        <Button
          variant={productTypeFilter === "HEADQUARTERS" ? "default" : "outline"}
          size="sm"
          onClick={() => setProductTypeFilter("HEADQUARTERS")}
        >
          업체발주서 (본사)
        </Button>
        <Button
          variant={productTypeFilter === "CENTER" ? "default" : "outline"}
          size="sm"
          onClick={() => setProductTypeFilter("CENTER")}
        >
          관리메이트 (센터)
        </Button>
        {!isSeller && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
              {showInactive ? "비활성 포함" : "활성만"}
            </Button>
          </>
        )}
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
