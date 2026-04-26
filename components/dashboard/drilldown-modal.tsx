"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type DrilldownType = "sales" | "count" | "avgPrice" | "margin";

interface DrilldownItem {
  name: string;
  value: number;
  count?: number;
}

interface DrilldownModalProps {
  open: boolean;
  onClose: () => void;
  type: DrilldownType | null;
  fromDate: string;
  toDate: string;
}

const typeLabels: Record<DrilldownType, string> = {
  sales: "매출 상세 (셀러별 TOP 5)",
  count: "판매건수 상세 (상품별 TOP 5)",
  avgPrice: "평균단가 상세 (상품별 TOP 5)",
  margin: "마진 상세 (상품별 TOP 5)",
};

const valueLabels: Record<DrilldownType, string> = {
  sales: "매출",
  count: "판매건수",
  avgPrice: "평균단가",
  margin: "마진",
};

const valueFormatters: Record<DrilldownType, (v: number) => string> = {
  sales: (v) => `${v.toLocaleString()}원`,
  count: (v) => `${v.toLocaleString()}건`,
  avgPrice: (v) => `${v.toLocaleString()}원`,
  margin: (v) => `${v.toLocaleString()}원`,
};

export function DrilldownModal({ open, onClose, type, fromDate, toDate }: DrilldownModalProps) {
  const [data, setData] = useState<DrilldownItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !type) return;

    setLoading(true);
    fetch(`/api/stats/dashboard/drilldown?type=${type}&fromDate=${fromDate}&toDate=${toDate}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((result) => {
        setData(result.data?.topItems || []);
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  }, [open, type, fromDate, toDate]);

  if (!type) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{typeLabels[type]}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          {fromDate} ~ {toDate}
        </p>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            데이터가 없습니다
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">순위</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="text-right">{valueLabels[type]}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {valueFormatters[type](item.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
