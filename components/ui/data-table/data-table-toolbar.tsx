"use client";

import { memo } from "react";
import type { Table, Column } from "@tanstack/react-table";
import { Search, Download, SlidersHorizontal, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FilterableColumn, BulkAction } from "@/types/data-table";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  searchPlaceholder?: string;
  filterableColumns?: FilterableColumn[];
  enableExport?: boolean;
  onExport?: () => void;
  bulkActions?: BulkAction<TData>[];
  onCreateClick?: () => void;
  createLabel?: string;
  hideSearch?: boolean;
}

function DataTableToolbarInner<TData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  searchPlaceholder = "검색...",
  filterableColumns = [],
  enableExport = false,
  onExport,
  bulkActions = [],
  onCreateClick,
  createLabel = "새로 만들기",
  hideSearch = false,
}: DataTableToolbarProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const isFiltered =
    globalFilter.length > 0 ||
    table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* 글로벌 검색 */}
        {!hideSearch && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-grey-400" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => onGlobalFilterChange(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {globalFilter && (
              <button
                onClick={() => onGlobalFilterChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-400 hover:text-grey-600"
                aria-label="검색어 지우기"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* 컬럼 필터 */}
        {filterableColumns.map((filterCol) => {
          const column = table.getColumn(filterCol.id);
          if (!column) return null;
          const currentValue = column.getFilterValue() as string | undefined;

          return (
            <FilterDropdown
              key={filterCol.id}
              column={column}
              title={filterCol.title}
              options={filterCol.options}
              currentValue={currentValue}
            />
          );
        })}

        {/* 필터 초기화 */}
        {!hideSearch && isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-grey-500"
            onClick={() => {
              onGlobalFilterChange("");
              table.resetColumnFilters();
            }}
          >
            초기화
            <X className="ml-1 size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* 새로 만들기 */}
        {onCreateClick && (
          <Button size="sm" className="h-9" onClick={onCreateClick}>
            <Plus className="mr-1.5 size-3.5" />
            {createLabel}
          </Button>
        )}

        {/* 대량 작업 */}
        {selectedCount > 0 && bulkActions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-grey-500">{selectedCount}개 선택</span>
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant === "destructive" ? "destructive" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => {
                  const selectedRows = table
                    .getFilteredSelectedRowModel()
                    .rows.map((r) => r.original);
                  action.onClick(selectedRows);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* CSV 내보내기 */}
        {enableExport && onExport && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={onExport}
          >
            <Download className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">내보내기</span>
          </Button>
        )}

        {/* 컬럼 표시/숨기기 */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9"
            )}
          >
            <SlidersHorizontal className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">컬럼</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>표시 컬럼</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (col) => col.getCanHide() && col.id !== "select"
              )
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                >
                  {typeof col.columnDef.header === "string"
                    ? col.columnDef.header
                    : col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export const DataTableToolbar = memo(DataTableToolbarInner) as typeof DataTableToolbarInner;

// --- Filter Dropdown ---

function FilterDropdown<TData>({
  column,
  title,
  options,
  currentValue,
}: {
  column: Column<TData, unknown>;
  title: string;
  options: { label: string; value: string }[];
  currentValue: string | undefined;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-9 border-dashed",
          currentValue && "border-blue-300 bg-blue-50 text-blue-600"
        )}
      >
        {currentValue
          ? options.find((o) => o.value === currentValue)?.label ?? currentValue
          : title}
        {currentValue && (
          <button
            className="ml-1.5 rounded-full hover:bg-blue-200"
            onClick={(e) => {
              e.stopPropagation();
              column.setFilterValue(undefined);
            }}
            aria-label={`${title} 필터 해제`}
          >
            <X className="size-3" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {options.map((option) => (
          <button
            key={option.value}
            className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-grey-100 ${
              currentValue === option.value ? "bg-grey-100 font-medium" : ""
            }`}
            onClick={() => {
              column.setFilterValue(
                currentValue === option.value ? undefined : option.value
              );
            }}
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
