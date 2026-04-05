import type { SortingState, ColumnFiltersState, ColumnDef } from "@tanstack/react-table";

export interface FetchPageParams {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
}

export interface FetchPageResult<TData> {
  data: TData[];
  totalCount: number;
  pageCount: number;
}

export type DataSource<TData> =
  | { mode: "client"; fetchAll: () => TData[] }
  | { mode: "server"; fetchPage: (params: FetchPageParams) => Promise<FetchPageResult<TData>> };

export interface FilterableColumn {
  id: string;
  title: string;
  options: { label: string; value: string }[];
}

export interface BulkAction<TData> {
  label: string;
  onClick: (selectedRows: TData[]) => void;
  variant?: "default" | "destructive";
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  dataSource: DataSource<TData>;
  title?: string;
  searchPlaceholder?: string;
  filterableColumns?: FilterableColumn[];
  bulkActions?: BulkAction<TData>[];
  enableColumnResizing?: boolean;
  enableRowSelection?: boolean;
  enableExport?: boolean;
  exportFileName?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  onRowClick?: (row: TData) => void;
  onCreateClick?: () => void;
  createLabel?: string;
  defaultColumnVisibility?: Record<string, boolean>;
  hideSearch?: boolean;
}
