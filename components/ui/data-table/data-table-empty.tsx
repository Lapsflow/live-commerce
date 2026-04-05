import { TableCell, TableRow } from "@/components/ui/table";
import { Inbox } from "lucide-react";

interface DataTableEmptyProps {
  columnCount: number;
  message?: string;
}

export function DataTableEmpty({
  columnCount,
  message = "데이터가 없습니다.",
}: DataTableEmptyProps) {
  return (
    <TableRow>
      <TableCell colSpan={columnCount} className="h-48 text-center">
        <div className="flex flex-col items-center gap-2 text-grey-400">
          <Inbox className="size-10 stroke-1" />
          <p className="text-sm">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
