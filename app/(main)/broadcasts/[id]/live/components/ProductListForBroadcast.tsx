"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package } from "lucide-react";
import type { Product } from "@/types/product";

interface ProductWithCenterStock extends Product {
  centerStocks?: Array<{
    id: string;
    centerId: string;
    stock: number;
  }>;
  productType?: string;
}

interface ProductListForBroadcastProps {
  products: ProductWithCenterStock[];
}

export function ProductListForBroadcast({ products }: ProductListForBroadcastProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="상품명, 바코드, 상품코드로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>검색 결과가 없습니다</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const centerStock = product.centerStocks?.[0];
            const isHqProduct = product.productType === "HEADQUARTERS";
            const stock = isHqProduct ? product.totalStock : (centerStock?.stock || 0);

            return (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{product.name}</h4>
                    {isHqProduct && (
                      <Badge variant="secondary" className="text-xs">
                        본사
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>바코드: {product.barcode}</span>
                    <span>상품코드: {product.code}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">판매가</div>
                    <div className="font-semibold text-lg">
                      {product.sellPrice.toLocaleString()}원
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">재고</div>
                    <div
                      className={`font-semibold text-lg ${
                        stock < 10
                          ? "text-destructive"
                          : stock < 30
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {stock}개
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
