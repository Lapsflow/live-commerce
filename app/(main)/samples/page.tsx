import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { ProductFilters } from "./components/ProductFilters";
import { AddToCartButton } from "./components/AddToCartButton";

interface SamplesPageProps {
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function SamplesPage({ searchParams }: SamplesPageProps) {
  const { search } = await searchParams;

  // 상품 조회 (필터 적용)
  const products = await prisma.product.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">샘플 쇼핑몰</h1>
          <p className="text-muted-foreground mt-1">
            원하는 상품의 샘플을 요청하세요
          </p>
        </div>
        <Link href="/samples/cart">
          <Button>
            <ShoppingCart className="mr-2 h-4 w-4" />
            장바구니
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <ProductFilters />

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
        {products.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p>검색 결과가 없습니다</p>
          </div>
        ) : (
          products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2">
                    {product.name}
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    샘플
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">바코드</span>
                    <span className="font-mono">{product.barcode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">상품코드</span>
                    <span className="font-mono">{product.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">판매가</span>
                    <span className="font-semibold">
                      {product.sellPrice.toLocaleString()}원
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
                      {product.totalStock}개
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Link href={`/samples/${product.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      상세보기
                    </Button>
                  </Link>
                  <AddToCartButton product={product} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
