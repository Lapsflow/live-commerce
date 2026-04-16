"use client";

import { flexRender } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataTable } from "@/hooks/use-data-table";
import { exportTableToCsv } from "@/lib/utils/csv-export";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableSkeleton } from "./data-table-skeleton";
import { DataTableEmpty } from "./data-table-empty";
import type { DataTableProps } from "@/types/data-table";

export function DataTable<TData, TValue>({
  columns,
  dataSource,
  title,
  searchPlaceholder,
  filterableColumns,
  bulkActions,
  enableColumnResizing = false,
  enableRowSelection = false,
  enableExport = false,
  exportFileName = "export",
  defaultPageSize = 20,
  pageSizeOptions,
  onRowClick,
  onCreateClick,
  createLabel,
  defaultColumnVisibility,
  hideSearch = false,
}: DataTableProps<TData, TValue>) {
  const { table, globalFilter, setGlobalFilter, isLoading, error } = useDataTable({
    columns,
    dataSource,
    enableColumnResizing,
    enableRowSelection,
    defaultPageSize,
    defaultColumnVisibility,
  });

  return (
    <div className="rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-md)]">
      {title && (
        <div className="px-4 pt-4 pb-0 sm:px-6 sm:pt-5">
          <h3 className="text-base font-bold text-grey-900 sm:text-lg">{title}</h3>
        </div>
      )}

      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        searchPlaceholder={searchPlaceholder}
        filterableColumns={filterableColumns}
        enableExport={enableExport}
        onExport={
          enableExport
            ? () => exportTableToCsv(table, exportFileName)
            : undefined
        }
        bulkActions={bulkActions}
        onCreateClick={onCreateClick}
        createLabel={createLabel}
        hideSearch={hideSearch}
      />

      {error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-lg bg-red-50 p-6 max-w-md">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-semibold">데이터를 불러올 수 없습니다</h3>
            </div>
            <p className="text-sm text-red-700 mb-4">
              {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <DataTableSkeleton columnCount={columns.length} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-grey-200">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as
                      | { align?: string }
                      | undefined;
                    const alignClass =
                      meta?.align === "right"
                        ? "text-right"
                        : meta?.align === "center"
                          ? "text-center"
                          : "text-left";

                    return (
                      <TableHead
                        key={header.id}
                        className={`px-3 text-xs font-semibold text-grey-500 sm:px-6 ${alignClass}`}
                        style={
                          header.getSize() !== 150
                            ? { width: header.getSize() }
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}

                        {/* 리사이즈 핸들 */}
                        {enableColumnResizing && header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100 hover:bg-grey-300"
                            style={{
                              transform: header.column.getIsResizing()
                                ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                                : "",
                            }}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`border-grey-100 transition-colors hover:bg-grey-50 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        | { align?: string }
                        | undefined;
                      const alignClass =
                        meta?.align === "right"
                          ? "text-right"
                          : meta?.align === "center"
                            ? "text-center"
                            : "";

                      return (
                        <TableCell
                          key={cell.id}
                          className={`px-3 text-sm text-grey-700 sm:px-6 ${alignClass}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <DataTableEmpty columnCount={columns.length} />
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
    </div>
  );
}
