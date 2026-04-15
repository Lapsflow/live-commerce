import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Barcode, DollarSign, Warehouse } from "lucide-react";
import { AddToCartButton } from "../components/AddToCartButton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface SampleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SampleDetailPage({ params }: SampleDetailPageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      centerStocks: {
        include: {
          center: {
            select: {
              id: true,
              code: true,
              name: true,
              regionName: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <Link href="/samples">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-2xl">{product.name}</CardTitle>
              <Badge variant="secondary" className="text-base px-3 py-1">
                샘플
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Barcode className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">바코드</div>
                  <div className="font-mono font-semibold">{product.barcode}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">상품코드</div>
                  <div className="font-mono font-semibold">{product.code}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">판매가</div>
                  <div className="font-semibold text-lg">
                    {product.sellPrice.toLocaleString()}원
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Warehouse className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">총 재고</div>
                  <div
                    className={`font-semibold text-lg ${
                      product.totalStock < 10
                        ? "text-destructive"
                        : "text-green-600"
                    }`}
                  >
                    {product.totalStock}개
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Center Stock Details */}
            {product.centerStocks && product.centerStocks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">센터별 재고</h3>
                <div className="space-y-2">
                  {product.centerStocks.map((centerStock) => (
                    <div
                      key={centerStock.id}
                      className="flex justify-between items-center p-3 bg-muted/50 rounded"
                    >
                      <div>
                        <div className="font-medium">{centerStock.center.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {centerStock.center.code} • {centerStock.center.regionName}
                        </div>
                      </div>
                      <div
                        className={`font-semibold ${
                          centerStock.stock < 10
                            ? "text-destructive"
                            : "text-green-600"
                        }`}
                      >
                        {centerStock.stock}개
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Sample Info */}
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">샘플 정보</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 샘플은 무료로 제공됩니다</li>
                <li>• 1회 최대 3개까지 요청 가능합니다</li>
                <li>• 승인 후 2-3일 내 배송됩니다</li>
                <li>• 재고가 부족한 경우 승인이 거절될 수 있습니다</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Right: Action Card */}
        <Card>
          <CardHeader>
            <CardTitle>샘플 요청</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">샘플 가격</div>
              <div className="text-3xl font-bold text-green-600">무료</div>
            </div>

            <AddToCartButton product={product} variant="full" />

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 장바구니에 담으신 후 일괄 요청하세요</p>
              <p>• MASTER 또는 SUB_MASTER 승인 후 배송 시작</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
