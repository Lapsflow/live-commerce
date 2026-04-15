"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package } from "lucide-react";
import { normBarcode } from "@/lib/utils/barcode";
import { PricingInfoCard } from "./components/PricingInfoCard";
import { AIAnalysisCard } from "./components/AIAnalysisCard";
import { OrderInputCard } from "./components/OrderInputCard";

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  location?: string;
  lastUpdated: string;
}

interface ProductWithInventory {
  id: string;
  name: string;
  code: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  totalStock: number; // Sum of all warehouses
  warehouses: WarehouseStock[];
}

// 마진율 계산 함수
function calculateMarginRate(sellPrice: number, supplyPrice: number): number {
  if (sellPrice === 0) return 0;
  return Math.round(((sellPrice - supplyPrice) / sellPrice) * 100);
}

export default function BarcodePage() {
  // Phase 3: Get session data for center information
  const { data: session } = useSession();
  const center = (session?.user as any)?.center;

  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<ProductWithInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!barcode.trim()) {
      setError("바코드를 입력하세요");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalized = normBarcode(barcode);
      const res = await fetch(`/api/barcode/search?barcode=${encodeURIComponent(normalized)}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError("해당 바코드의 상품이 없습니다");
        } else {
          throw new Error("상품 검색 중 오류가 발생했습니다");
        }
        setProduct(null);
        return;
      }

      const data = await res.json();
      if (data.product) {
        setProduct(data.product);
      } else {
        setError("해당 바코드의 상품이 없습니다");
        setProduct(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">바코드 재고 조회</h1>
      </div>

      {/* Barcode Search Input */}
      <Card className="p-6 mb-6 shadow-lg">
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="바코드를 입력하세요 (Enter로 검색)"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 text-lg"
            autoFocus
          />
          <Button onClick={handleSearch} disabled={loading} size="lg">
            <Search className="mr-2 h-4 w-4" />
            {loading ? "검색중..." : "검색"}
          </Button>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
      </Card>

      {/* Product Result - 2 Column Responsive Layout */}
      {product && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Product Info Card */}
            <Card className="p-6 shadow-lg">
              <h2 className="text-2xl font-bold mb-4 pb-2 border-b">{product.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">상품코드</p>
                  <p className="font-medium text-lg">{product.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">바코드</p>
                  <p className="font-medium text-lg font-mono">{product.barcode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">총 재고</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {product.totalStock.toLocaleString()}개
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">판매가</p>
                  <p className="font-medium text-lg">
                    {product.sellPrice.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">공급가</p>
                  <p className="font-medium text-lg">
                    {product.supplyPrice.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">마진율</p>
                  <p className="font-medium text-2xl text-green-600">
                    {calculateMarginRate(product.sellPrice, product.supplyPrice)}%
                  </p>
                </div>
              </div>
            </Card>

            {/* Pricing Info Card - NEW */}
            <PricingInfoCard barcode={product.barcode} ourPrice={product.sellPrice} />

            {/* Warehouse Inventory Table */}
            <Card className="p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4 pb-2 border-b">
                창고별 재고 현황
              </h3>

              {product.warehouses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  등록된 창고 재고가 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-left py-3 px-4 font-semibold">창고명</th>
                        <th className="text-left py-3 px-4 font-semibold">위치</th>
                        <th className="text-right py-3 px-4 font-semibold">수량</th>
                        <th className="text-right py-3 px-4 font-semibold">
                          최종 업데이트
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.warehouses.map((wh) => (
                        <tr key={wh.warehouseId} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{wh.warehouseName}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {wh.location || "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {wh.quantity > 0 ? (
                              <span className="text-green-600">
                                {wh.quantity.toLocaleString()}개
                              </span>
                            ) : (
                              <span className="text-red-600">재고없음</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                            {new Date(wh.lastUpdated).toLocaleString("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30">
                        <td colSpan={2} className="py-3 px-4 font-bold">
                          전체 합계
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600 text-lg">
                          {product.totalStock.toLocaleString()}개
                        </td>
                        <td className="py-3 px-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* AI Analysis Card - NEW */}
            <AIAnalysisCard barcode={product.barcode} productName={product.name} />

            {/* Order Input Card - NEW */}
            {/* Phase 3: Pass center data to OrderInputCard */}
            <OrderInputCard product={product} center={center} />
          </div>
        </div>
      )}
    </div>
  );
}
