"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Trash2, Loader2, Package, ArrowLeft, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  samplePrice: number;
  product: {
    id: string;
    code: string;
    name: string;
    barcode: string;
    sellPrice: number;
    totalStock: number;
  };
}

interface CartSummary {
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
}

export default function SamplesCartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary>({
    totalItems: 0,
    totalQuantity: 0,
    totalAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/proposals/cart");
      const data = await res.json();

      if (res.ok && data.data) {
        setItems(data.data.items);
        setSummary(data.data.summary);
      }
    } catch {
      toast({
        title: "오류",
        description: "장바구니를 불러올 수 없습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      const res = await fetch(`/api/proposals/cart?productId=${productId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "삭제 실패");
      }

      toast({
        title: "장바구니 제거",
        description: "상품이 장바구니에서 제거되었습니다",
      });

      loadCart();
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/proposals/cart/checkout", {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "샘플 요청 실패");
      }

      const data = await res.json();

      toast({
        title: "샘플 요청 완료",
        description: `${data.data.proposalCount}개의 샘플이 요청되었습니다`,
      });

      router.push("/proposals");
    } catch (err: any) {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const freeItems = items.filter((item) => item.samplePrice === 0);
  const paidItems = items.filter((item) => item.samplePrice > 0);
  const paidTotal = paidItems.reduce(
    (sum, item) => sum + item.samplePrice * item.quantity,
    0
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Link href="/samples">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          쇼핑 계속하기
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Cart Items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <CardTitle>장바구니 ({summary.totalItems}개)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">장바구니가 비어있습니다</p>
                <Link href="/samples">
                  <Button>상품 둘러보기</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 무료 샘플 */}
                {freeItems.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      무료 샘플 ({freeItems.length}건)
                    </h3>
                    {freeItems.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        onRemove={handleRemove}
                      />
                    ))}
                  </>
                )}

                {/* 유료 샘플 */}
                {paidItems.length > 0 && (
                  <>
                    {freeItems.length > 0 && <Separator className="my-4" />}
                    <h3 className="text-sm font-medium text-muted-foreground">
                      유료 샘플 ({paidItems.length}건)
                    </h3>
                    {paidItems.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        onRemove={handleRemove}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Summary */}
        <Card>
          <CardHeader>
            <CardTitle>주문 요약</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">총 상품 수</span>
                <span className="font-semibold">{summary.totalItems}개</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">총 수량</span>
                <span className="font-semibold">{summary.totalQuantity}개</span>
              </div>

              {freeItems.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">무료 샘플</span>
                  <span className="font-semibold text-green-600">{freeItems.length}건</span>
                </div>
              )}

              {paidItems.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">유료 샘플</span>
                  <span className="font-semibold text-blue-600">{paidItems.length}건</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-semibold">합계</span>
                {paidTotal > 0 ? (
                  <span className="text-2xl font-bold text-blue-600">
                    {paidTotal.toLocaleString()}원
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-green-600">무료</span>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCheckout}
              disabled={items.length === 0 || isCheckingOut}
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  요청 중...
                </>
              ) : paidTotal > 0 ? (
                "샘플 요청 (무통장입금)"
              ) : (
                "샘플 요청"
              )}
            </Button>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 샘플 요청 후 MASTER/SUB_MASTER 승인 필요</p>
              <p>• 승인 후 2-3일 내 배송 시작</p>
              {paidTotal > 0 && (
                <p>• 유료 샘플은 승인 후 입금 안내가 발송됩니다</p>
              )}
              <p>• 승인 상태는 제안 페이지에서 확인 가능</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CartItemRow({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: (productId: string) => void;
}) {
  const isFree = item.samplePrice === 0;

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold truncate mb-1">{item.product.name}</h4>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>코드: {item.product.code}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">수량: {item.quantity}개</Badge>
          {isFree ? (
            <Badge variant="outline" className="text-green-600 border-green-300">
              무료
            </Badge>
          ) : (
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              {(item.samplePrice * item.quantity).toLocaleString()}원
            </Badge>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(item.productId)}
        className="shrink-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
