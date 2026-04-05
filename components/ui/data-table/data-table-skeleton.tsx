import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableSkeletonProps {
  columnCount: number;
  rowCount?: number;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
}: DataTableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-grey-200">
          {Array.from({ length: columnCount }).map((_, i) => (
            <TableHead key={i} className="px-6">
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }).map((_, rowIdx) => (
          <TableRow key={rowIdx} className="border-grey-100">
            {Array.from({ length: columnCount }).map((_, colIdx) => (
              <TableCell key={colIdx} className="px-6">
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
