"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  ColumnSizingState,
} from "@tanstack/react-table";
import type { DataSource, FetchPageResult } from "@/types/data-table";

interface UseDataTableOptions<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  dataSource: DataSource<TData>;
  enableColumnResizing?: boolean;
  enableRowSelection?: boolean;
  defaultPageSize?: number;
  defaultColumnVisibility?: Record<string, boolean>;
}

// SWR fetcher that delegates to dataSource.fetchPage
async function serverFetcher<TData>(
  _key: string,
  fetchPage: Extract<DataSource<TData>, { mode: "server" }>["fetchPage"],
  params: string
): Promise<FetchPageResult<TData>> {
  const parsed = JSON.parse(params);
  return fetchPage(parsed);
}

export function useDataTable<TData, TValue>({
  columns,
  dataSource,
  enableColumnResizing = false,
  enableRowSelection = false,
  defaultPageSize = 20,
  defaultColumnVisibility = {},
}: UseDataTableOptions<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const pagination = useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize]
  );

  // Debounce global filter (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalFilter(globalFilter);
      if (dataSource.mode === "server") {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [globalFilter, dataSource.mode]);

  // Client mode: 데이터 직접 가져오기
  const clientData = useMemo(() => {
    if (dataSource.mode === "client" && dataSource.fetchAll) {
      return dataSource.fetchAll();
    }
    return [];
  }, [dataSource]);

  // Server mode: SWR-based fetching
  const fetchParams = useMemo(
    () =>
      JSON.stringify({
        pageIndex,
        pageSize,
        sorting,
        columnFilters,
        globalFilter: debouncedGlobalFilter,
      }),
    [pageIndex, pageSize, sorting, columnFilters, debouncedGlobalFilter]
  );

  const swrKey =
    dataSource.mode === "server"
      ? ["dataTable", fetchParams]
      : null;

  const { data: serverResult, isLoading: swrLoading, error: swrError } = useSWR<FetchPageResult<TData>>(
    swrKey,
    ([, params]: string[]) => {
      if (dataSource.mode !== "server") {
        throw new Error("Invalid data source mode");
      }
      return serverFetcher<TData>("", dataSource.fetchPage, params);
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onError: (err: Error) => {
        toast.error(`데이터 조회 실패: ${err.message}`);
      },
    }
  );

  const serverData = serverResult?.data ?? [];
  const serverPageCount = serverResult?.pageCount ?? 0;
  const isLoading = dataSource.mode === "server" ? swrLoading : false;
  const error = dataSource.mode === "server" ? swrError : undefined;

  const data = dataSource.mode === "client" ? clientData : serverData;

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
      columnSizing,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: setPagination,

    getCoreRowModel: getCoreRowModel(),
    ...(dataSource.mode === "client"
      ? {
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
        }
      : {
          manualSorting: true,
          manualFiltering: true,
          manualPagination: true,
          pageCount: serverPageCount,
        }),

    enableColumnResizing,
    columnResizeMode: "onChange",
    enableRowSelection,
  });

  return {
    table,
    globalFilter,
    setGlobalFilter,
    isLoading,
    error,
  };
}
