"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScanHistory } from "../hooks/useScanHistory";
import { RefreshCw, Package, ArrowUp, ArrowDown, Eye, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface ScanHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const scanTypeConfig = {
  LOOKUP: {
    label: "조회",
    icon: Eye,
    variant: "default" as const,
  },
  INBOUND: {
    label: "입고",
    icon: ArrowDown,
    variant: "default" as const,
  },
  OUTBOUND: {
    label: "출고",
    icon: ArrowUp,
    variant: "destructive" as const,
  },
};

export function ScanHistoryDrawer({ open, onOpenChange }: ScanHistoryDrawerProps) {
  const { history, loading, error, refresh } = useScanHistory(20);

  const handleExportExcel = () => {
    if (history.length === 0) return;

    // CSV 생성 (엑셀 호환)
    const headers = ["스캔유형", "바코드", "상품명", "수량", "스캔일시"];
    const rows = history.map((item) => [
      scanTypeConfig[item.scanType]?.label || item.scanType,
      item.barcode,
      item.productName || "",
      item.quantity?.toString() || "",
      format(new Date(item.scannedAt), "yyyy-MM-dd HH:mm:ss"),
    ]);

    const bom = "\uFEFF"; // UTF-8 BOM for Excel
    const csv = bom + [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `스캔이력_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>최근 스캔 이력</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExportExcel}
                disabled={loading || history.length === 0}
                title="엑셀 내보내기"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription>
            최근 20건의 바코드 스캔 기록입니다.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {error && (
            <div className="text-sm text-destructive p-4 bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}

          {!loading && history.length === 0 && (
            <div className="text-center text-muted-foreground p-8">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>스캔 이력이 없습니다</p>
            </div>
          )}

          <div className="space-y-3">
            {history.map((item) => {
              const config = scanTypeConfig[item.scanType];
              const Icon = config.icon;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={config.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {item.quantity && (
                          <span className="text-sm text-muted-foreground">
                            × {item.quantity}
                          </span>
                        )}
                      </div>
                      <div className="font-medium">
                        {item.productName || "상품 정보 없음"}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {item.barcode}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(item.scannedAt), "M월 d일 HH:mm", {
                      locale: ko,
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
