"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Settings } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "./components/AddToCartButton";
import { useSession } from "next-auth/react";

const categoryLabels: Record<string, string> = {
  LIVING: "생활용품",
  FOOD: "식품",
  GENERAL: "잡화",
  CLOTHING: "의류",
  BABY: "유아",
  PET: "애견",
  BEAUTY: "뷰티",
  HEALTH: "건강",
  OTHER: "기타",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  CONTINUOUS: { label: "꾸준한 제품", color: "bg-green-100 text-green-700" },
  UNTIL_SOLD: { label: "소진후 종료", color: "bg-orange-100 text-orange-700" },
};

interface SampleProduct {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  totalStock: number;
  productType: string;
  isSample: boolean;
  sampleCategory: string | null;
  samplePrice: number | null;
  sampleStatus: string | null;
}

export default function SamplesPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<SampleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [priceType, setPriceType] = useState<string>("ALL");

  const userRole = (session?.user as any)?.role;
  const isManager = userRole === "MASTER" || userRole === "SUB_MASTER";

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (priceType === "free") params.set("priceType", "free");
      if (priceType === "paid") params.set("priceType", "paid");
      if (search) params.set("search", search);

      const res = await fetch(`/api/samples?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setProducts(data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(loadProducts, 300);
    return () => clearTimeout(timeout);
  }, [search, category, priceType]);

  const formatPrice = (price: number | null) => {
    if (price === null) return "비공개";
    if (price === 0) return "무료";
    return `${price.toLocaleString()}원`;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">샘플 쇼핑몰</h1>
          <p className="text-muted-foreground mt-1">
            원하는 상품의 샘플을 요청하세요
          </p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Link href="/samples/manage">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                샘플 관리
              </Button>
            </Link>
          )}
          <Link href="/samples/cart">
            <Button>
              <ShoppingCart className="mr-2 h-4 w-4" />
              장바구니
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="상품명, 바코드, 상품코드로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant={category === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategory("ALL")}
        >
          전체
        </Button>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <Button
            key={key}
            variant={category === key ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Price Type Filter */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={priceType === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setPriceType("ALL")}
        >
          전체
        </Button>
        <Button
          variant={priceType === "free" ? "default" : "outline"}
          size="sm"
          onClick={() => setPriceType("free")}
          className={priceType === "free" ? "bg-green-600 hover:bg-green-700" : ""}
        >
          무료 샘플
        </Button>
        <Button
          variant={priceType === "paid" ? "default" : "outline"}
          size="sm"
          onClick={() => setPriceType("paid")}
          className={priceType === "paid" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          유료 샘플
        </Button>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const isSoldOut =
              product.sampleStatus === "UNTIL_SOLD" && product.totalStock <= 0;

            return (
              <Card
                key={product.id}
                className={`overflow-hidden hover:shadow-lg transition-shadow ${
                  isSoldOut ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">
                      {product.name}
                    </CardTitle>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {product.sampleCategory && (
                        <Badge variant="secondary" className="text-xs">
                          {categoryLabels[product.sampleCategory] || product.sampleCategory}
                        </Badge>
                      )}
                      {product.sampleStatus && statusLabels[product.sampleStatus] && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusLabels[product.sampleStatus].color}`}
                        >
                          {statusLabels[product.sampleStatus].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">상품코드</span>
                      <span className="font-mono">{product.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">정가</span>
                      <span>{product.sellPrice.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">샘플가</span>
                      <span
                        className={`font-semibold ${
                          product.samplePrice === 0
                            ? "text-green-600"
                            : "text-blue-600"
                        }`}
                      >
                        {formatPrice(product.samplePrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">재고</span>
                      <span
                        className={
                          product.totalStock < 10
                            ? "text-destructive font-semibold"
                            : "text-green-600"
                        }
                      >
                        {isSoldOut ? "품절" : `${product.totalStock}개`}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Link href={`/samples/${product.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        상세보기
                      </Button>
                    </Link>
                    {!isSoldOut && (
                      <AddToCartButton
                        product={product}
                        samplePrice={product.samplePrice ?? 0}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
