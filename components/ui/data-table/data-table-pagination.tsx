"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

// ⚠️ memo() 금지 (2026-07-10 버그 수정): TanStack Table 의 `table` 인스턴스는
// 참조가 불변이라 memo 가 재렌더를 전부 차단 → 페이지당 select 표시값·페이지
// 번호·이동 버튼 disabled 상태가 초기 렌더(pageCount=0)에 영구 동결됐음.
// (다음/마지막 버튼이 항상 비활성, "페이지당 20→50" 눌러도 표시 안 바뀌는 증상)
export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [20, 30, 50],
}: DataTablePaginationProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  // 2026-07-10: server 모드에서 getFilteredRowModel 은 현재 페이지 행수만 반환 —
  // getRowCount() 는 rowCount(서버 totalCount) 우선, client 모드는 필터 후 전체.
  const totalCount = table.getRowCount();

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
      <div className="text-sm text-grey-500">
        {selectedCount > 0
          ? `${totalCount}개 중 ${selectedCount}개 선택`
          : `총 ${totalCount}건`}
      </div>

      <div className="flex items-center justify-between gap-4 sm:gap-6">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm text-grey-500">페이지당</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-grey-500">건</span>
        </div>

        <div className="text-sm text-grey-500">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          페이지
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="hidden size-8 sm:inline-flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="첫 페이지로 이동"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="다음 페이지"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden size-8 sm:inline-flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="마지막 페이지로 이동"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
