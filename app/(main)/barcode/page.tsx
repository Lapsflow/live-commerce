"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { Product } from "@/types/product";
import { normBarcode } from "@/lib/utils/barcode";

// 마진율 계산 함수
function calculateMarginRate(sellPrice: number, supplyPrice: number): number {
  if (sellPrice === 0) return 0;
  return Math.round(((sellPrice - supplyPrice) / sellPrice) * 100);
}

export default function BarcodePage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
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
      // Normalize barcode before search
      const normalizedBarcode = normBarcode(barcode);
      const res = await fetch(`/api/products?search=${encodeURIComponent(normalizedBarcode)}`);
      if (!res.ok) throw new Error("상품을 찾을 수 없습니다");

      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setProduct(data.data[0]);
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
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">바코드 스캔</h1>

      <Card className="p-6 mb-6">
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="바코드를 입력하세요"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "검색중..." : "검색"}
          </Button>
        </div>
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
      </Card>

      {product && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">상품 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">상품코드</p>
              <p className="font-medium">{product.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">상품명</p>
              <p className="font-medium">{product.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">바코드</p>
              <p className="font-medium">{product.barcode}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">판매가</p>
              <p className="font-medium">{product.sellPrice.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">공급가</p>
              <p className="font-medium">{product.supplyPrice.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">마진율</p>
              <p className="font-medium text-lg text-green-600">
                {calculateMarginRate(product.sellPrice, product.supplyPrice)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">마진액</p>
              <p className="font-medium text-green-600">
                {(product.sellPrice - product.supplyPrice).toLocaleString()}원
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">총재고</p>
              <p className="font-medium">{product.totalStock.toLocaleString()}개</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">무진재고</p>
              <p className="font-medium">{product.stockMujin}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">1층재고</p>
              <p className="font-medium">{product.stock1}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">2층재고</p>
              <p className="font-medium">{product.stock2}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">3층재고</p>
              <p className="font-medium">{product.stock3}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
