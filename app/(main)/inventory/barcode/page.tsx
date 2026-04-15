"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScannerContainer } from "./components/BarcodeScannerContainer";
import { ScanHistoryDrawer } from "./components/ScanHistoryDrawer";
import { BarcodeQueryProvider } from "./providers/QueryProvider";
import { ArrowLeft, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ScanMode = "INBOUND" | "OUTBOUND" | "LOOKUP";

export default function BarcodeScannerPage() {
  const router = useRouter();
  const [scanMode, setScanMode] = useState<ScanMode>("LOOKUP");
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <BarcodeQueryProvider>
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">바코드 스캔</h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-5 w-5" />
          </Button>
        </div>

        {/* Mode Selection Tabs */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>스캔 모드 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="LOOKUP">상품 조회</TabsTrigger>
                <TabsTrigger value="INBOUND">입고 처리</TabsTrigger>
                <TabsTrigger value="OUTBOUND">출고 처리</TabsTrigger>
              </TabsList>

              <TabsContent value="LOOKUP" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  바코드를 스캔하여 상품 정보와 재고 현황을 확인합니다.
                </p>
              </TabsContent>
              <TabsContent value="INBOUND" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  입고된 상품 바코드를 스캔하여 재고를 추가합니다.
                </p>
              </TabsContent>
              <TabsContent value="OUTBOUND" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  출고할 상품 바코드를 스캔하여 재고를 차감합니다.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Scanner Component */}
        <BarcodeScannerContainer mode={scanMode} />

        {/* Scan History Drawer */}
        <ScanHistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />
      </div>
    </BarcodeQueryProvider>
  );
}
