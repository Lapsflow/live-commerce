"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn(className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 data-[state=open]:bg-accent", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
      aria-label={`${title} ${sorted === "asc" ? "내림차순" : sorted === "desc" ? "정렬 해제" : "오름차순"} 정렬`}
    >
      {title}
      {sorted === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : sorted === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 size-3.5 opacity-50" />
      )}
    </Button>
  );
}
