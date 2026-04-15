"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Download, Mic, Plus, Minus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// Phase 3: Add center prop for center data propagation
interface OrderInputCardProps {
  product: {
    id: string;
    name: string;
    barcode: string;
    sellPrice: number;
    totalStock: number;
  };
  center?: { id: string; name: string } | null;
}

interface OrderItem {
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export function OrderInputCard({ product, center }: OrderInputCardProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [orders, setOrders] = useState<OrderItem[]>([]);

  const totalAmount = orders.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalQuantity = orders.reduce((sum, item) => sum + item.quantity, 0);

  const incrementQuantity = () => {
    if (quantity < product.totalStock) {
      setQuantity((prev) => prev + 1);
    } else {
      toast.error(`재고가 ${product.totalStock}개밖에 없습니다`);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      if (num <= product.totalStock) {
        setQuantity(num);
      } else {
        toast.error(`재고가 ${product.totalStock}개밖에 없습니다`);
        setQuantity(product.totalStock);
      }
    } else if (value === "") {
      setQuantity(1);
    }
  };

  const addOrder = () => {
    if (quantity > product.totalStock) {
      toast.error(`재고가 부족합니다 (현재 재고: ${product.totalStock}개)`);
      return;
    }

    // Check if product already in cart
    const existingIndex = orders.findIndex(
      (item) => item.productId === product.id
    );

    if (existingIndex >= 0) {
      // Update existing item
      const newOrders = [...orders];
      newOrders[existingIndex].quantity += quantity;
      newOrders[existingIndex].totalPrice =
        newOrders[existingIndex].quantity * product.sellPrice;
      setOrders(newOrders);
      toast.success(`수량이 ${quantity}개 추가되었습니다`);
    } else {
      // Add new item
      setOrders([
        ...orders,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          quantity,
          unitPrice: product.sellPrice,
          totalPrice: product.sellPrice * quantity,
        },
      ]);
      toast.success("장바구니에 추가되었습니다");
    }

    setQuantity(1); // Reset quantity
  };

  const removeOrder = (index: number) => {
    const newOrders = orders.filter((_, i) => i !== index);
    setOrders(newOrders);
    toast.success("장바구니에서 제거되었습니다");
  };

  const clearOrders = () => {
    setOrders([]);
    toast.success("장바구니가 비워졌습니다");
  };

  const downloadExcel = () => {
    if (orders.length === 0) {
      toast.error("주문 목록이 비어있습니다");
      return;
    }

    try {
      toast.success("엑셀 다운로드 준비 중...");

      // Phase 3: XLSX export with real center data
      const data = orders.map((item) => ({
        상품명: item.productName,
        바코드: item.barcode,
        수량: item.quantity,
        단가: item.unitPrice,
        합계: item.totalPrice,
        센터명: center?.name || "-", // Use real center name
      }));

      // Create worksheet from data
      const ws = XLSX.utils.json_to_sheet(data);

      // Create workbook and append worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "주문서");

      // Generate and download Excel file
      XLSX.writeFile(wb, `주문서_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast.success("엑셀 파일이 다운로드되었습니다");
    } catch (error) {
      console.error("Excel download error:", error);
      toast.error("엑셀 다운로드 중 오류가 발생했습니다");
    }
  };

  const startBroadcast = () => {
    if (orders.length === 0) {
      toast.error("주문 목록이 비어있습니다");
      return;
    }

    // Navigate to broadcast calendar with order data
    const params = new URLSearchParams();
    params.set("products", JSON.stringify(orders));
    router.push(`/broadcasts/calendar?${params.toString()}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>주문 입력</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Quantity Input */}
        <div className="flex gap-2 mb-4">
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              onClick={decrementQuantity}
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              className="w-20 text-center border-0 focus-visible:ring-0"
              min={1}
              max={product.totalStock}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={incrementQuantity}
              disabled={quantity >= product.totalStock}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <span className="self-center text-muted-foreground">×</span>

          <Input
            value={`${product.sellPrice.toLocaleString()}원`}
            disabled
            className="flex-1"
          />

          <span className="self-center text-muted-foreground">=</span>

          <Input
            value={`${(product.sellPrice * quantity).toLocaleString()}원`}
            disabled
            className="flex-1 font-bold"
          />

          <Button onClick={addOrder}>
            <Plus className="w-4 h-4 mr-2" />
            추가
          </Button>
        </div>

        {/* Stock Info */}
        <div className="text-xs text-muted-foreground mb-4">
          현재 재고: {product.totalStock}개
        </div>

        {orders.length > 0 && (
          <>
            <Separator className="my-4" />

            {/* Order List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">
                  주문 목록 ({orders.length}건)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearOrders}
                  className="h-auto p-1 text-xs text-muted-foreground"
                >
                  <X className="w-3 h-3 mr-1" />
                  전체 삭제
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orders.map((order, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-2 bg-muted rounded-md text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{order.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.quantity}개 × {order.unitPrice.toLocaleString()}원
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">
                        {order.totalPrice.toLocaleString()}원
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeOrder(i)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-2" />

              {/* Totals */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">총 수량</span>
                  <span className="font-semibold">{totalQuantity}개</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>합계</span>
                  <span className="text-primary">
                    {totalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={downloadExcel}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                주문서 다운로드
              </Button>
              <Button onClick={startBroadcast} className="flex-1">
                <Mic className="w-4 h-4 mr-2" />
                방송 시작
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
