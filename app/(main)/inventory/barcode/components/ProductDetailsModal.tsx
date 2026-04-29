"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Package, MapPin, ExternalLink, ShoppingCart, ScanLine, Radio, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { PriceComparisonCard } from "./PriceComparisonCard";
import { AIInsightsCard } from "./AIInsightsCard";

type ScanMode = "INBOUND" | "OUTBOUND" | "LOOKUP";

interface ProductData {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  minSellPrice?: number | null;
  maxSellPrice?: number | null;
  totalStock: number;
  imageUrl?: string | null;
  centerStocks: Array<{
    centerId: string;
    centerCode: string;
    centerName: string;
    regionName: string;
    stock: number;
    location: string | null;
  }>;
  // ONEWMS 실시간 재고 필드
  realtimeStock: number | null;
  cachedStock: number;
  stockError: string | null;
  lastSyncedAt: string | null;
}

interface ProductDetailsModalProps {
  product: ProductData;
  mode: ScanMode;
  open: boolean;
  onClose: () => void;
  onProductUpdate?: (updatedProduct: ProductData) => void;
}

function formatSyncTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "방금 전";
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}

export function ProductDetailsModal({
  product,
  mode,
  open,
  onClose,
  onProductUpdate,
}: ProductDetailsModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<string>("");

  // 주문 입력 폼 상태 (PDF p5: 바코드 스캔 후 바로 주문 접수)
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [orderRecipient, setOrderRecipient] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [actionCompleted, setActionCompleted] = useState(false);
  const [refreshingStock, setRefreshingStock] = useState(false);

  // ONEWMS 실시간 재고 재시도
  const handleRetryStock = async () => {
    setRefreshingStock(true);
    try {
      const response = await fetch(`/api/products/barcode/${product.barcode}`);
      const data = await response.json();
      if (response.ok && data.data && onProductUpdate) {
        onProductUpdate(data.data);
        if (data.data.realtimeStock !== null) {
          toast({ title: "실시간 재고 조회 성공" });
        } else if (data.data.stockError) {
          toast({
            title: "재고 조회 실패",
            description: data.data.stockError,
            variant: "destructive",
          });
        }
      }
    } catch {
      toast({ title: "네트워크 오류", variant: "destructive" });
    } finally {
      setRefreshingStock(false);
    }
  };

  const handleInventoryAction = async () => {
    if (!selectedCenter) {
      toast({
        title: "센터를 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: "수량을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/inventory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: product.barcode,
          scanType: mode,
          quantity,
          centerId: selectedCenter,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "오류",
          description: data.error || "재고 처리 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ 처리 완료",
        description: `${mode === "INBOUND" ? "입고" : "출고"} ${quantity}개 처리가 완료되었습니다. (재고: ${data.data?.previousStock ?? "?"} → ${data.data?.updatedStock ?? "?"})`,
      });

      // Update product data in-place so the modal reflects new stock
      if (data.data?.product && onProductUpdate) {
        onProductUpdate(data.data.product);
      }

      // Reset quantity and show continue button
      setQuantity(1);
      setSelectedCenter("");
      setActionCompleted(true);
    } catch (error) {
      console.error("[Inventory Action Error]", error);
      toast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickOrder = async () => {
    if (orderQuantity <= 0) {
      toast({ title: "수량을 입력해주세요", variant: "destructive" });
      return;
    }

    try {
      setOrderLoading(true);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              productId: product.id,
              quantity: orderQuantity,
              unitPrice: product.supplyPrice,
            },
          ],
          recipient: orderRecipient || undefined,
          phone: orderPhone || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "주문 실패",
          description: data.error?.message || "주문 접수 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "주문이 접수되었습니다" });
      setShowOrderForm(false);
      setOrderQuantity(1);
      setOrderRecipient("");
      setOrderPhone("");
      onClose();
    } catch {
      toast({ title: "네트워크 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setOrderLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            스캔 완료
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="space-y-2">
            {product.imageUrl && (
              <div className="w-full h-48 relative rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 672px) 100vw, 672px"
                />
              </div>
            )}
            <h3 className="font-semibold text-lg">{product.name}</h3>
            <div className="flex gap-2 text-sm mb-2">
              <div>
                <span className="text-muted-foreground">바코드: </span>
                <span className="font-mono">{product.barcode}</span>
              </div>
              <div>
                <span className="text-muted-foreground">상품코드: </span>
                <span className="font-mono">{product.code}</span>
              </div>
            </div>
            {/* 4단계 가격 바 (PDF p4: WMS 기준 통제 시스템) */}
            <div className="grid grid-cols-4 gap-0 rounded-lg overflow-hidden border text-center text-sm">
              <div className="bg-gray-50 p-2 border-r">
                <div className="text-muted-foreground text-xs">공급가</div>
                <div className="font-semibold">{product.supplyPrice.toLocaleString()}원</div>
              </div>
              <div className="bg-yellow-50 p-2 border-r">
                <div className="text-muted-foreground text-xs">최소판매가</div>
                <div className="font-semibold text-yellow-700">
                  {product.minSellPrice ? `${product.minSellPrice.toLocaleString()}원` : "-"}
                </div>
              </div>
              <div className="bg-green-50 p-2 border-r">
                <div className="text-muted-foreground text-xs">권장판매가</div>
                <div className="font-semibold text-green-700">{product.sellPrice.toLocaleString()}원</div>
              </div>
              <div className="bg-red-50 p-2">
                <div className="text-muted-foreground text-xs">최대판매가</div>
                <div className="font-semibold text-red-700">
                  {product.maxSellPrice ? `${product.maxSellPrice.toLocaleString()}원` : "-"}
                </div>
              </div>
            </div>
            {product.sellPrice > 0 && product.supplyPrice > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                마진: {((product.sellPrice - product.supplyPrice) / product.sellPrice * 100).toFixed(0)}% ({(product.sellPrice - product.supplyPrice).toLocaleString()}원)
              </div>
            )}
          </div>

          {/* ONEWMS 실시간 재고 현황 */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              총 재고
              {product.realtimeStock !== null ? (
                <Badge className="bg-green-100 text-green-800 border-green-300" variant="outline">
                  실시간
                </Badge>
              ) : product.stockError ? (
                <Badge className="bg-red-100 text-red-800 border-red-300" variant="outline">
                  조회실패
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-300" variant="outline">
                  캐시
                </Badge>
              )}
            </h4>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
              <div>
                <span className="text-2xl font-bold">
                  {product.totalStock.toLocaleString()}
                </span>
                <span className="text-muted-foreground ml-1">개</span>
                {product.realtimeStock !== null && product.cachedStock !== product.realtimeStock && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (캐시: {product.cachedStock.toLocaleString()})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {product.lastSyncedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatSyncTime(product.lastSyncedAt)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRetryStock}
                  disabled={refreshingStock}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingStock ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            {/* ONEWMS 오류 경고 박스 */}
            {product.stockError && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-red-700">WMS 실시간 재고 조회 실패</p>
                  <p className="text-red-600 text-xs mt-0.5">{product.stockError}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    위 재고는 마지막 동기화 기준입니다.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-red-600 border-red-300 hover:bg-red-100"
                  onClick={handleRetryStock}
                  disabled={refreshingStock}
                >
                  {refreshingStock ? "조회 중..." : "재시도"}
                </Button>
              </div>
            )}
          </div>

          {/* Center Stock Levels */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              센터별 재고 현황
            </h4>
            <div className="space-y-2">
              {product.centerStocks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  센터별 재고 정보가 없습니다.
                </p>
              )}
              {product.centerStocks.map((stock) => (
                <div
                  key={stock.centerId}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border
                    ${
                      selectedCenter === stock.centerId
                        ? "border-primary bg-primary/5"
                        : "border-grey-200 hover:border-primary/50"
                    }
                    ${mode !== "LOOKUP" ? "cursor-pointer" : ""}
                  `}
                  onClick={() => {
                    if (mode !== "LOOKUP") {
                      setSelectedCenter(stock.centerId);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">
                        {stock.centerCode} - {stock.centerName}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {stock.regionName}
                        {stock.location && ` • ${stock.location}`}
                      </div>
                    </div>
                  </div>
                  <Badge
                    className={
                      stock.stock >= 50
                        ? "bg-green-100 text-green-800 border-green-300"
                        : stock.stock >= 10
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                        : stock.stock > 0
                        ? "bg-red-100 text-red-800 border-red-300"
                        : "bg-grey-100 text-grey-500 border-grey-300"
                    }
                    variant="outline"
                  >
                    {stock.stock >= 50
                      ? "많음"
                      : stock.stock >= 10
                      ? "부족"
                      : stock.stock > 0
                      ? "위험"
                      : "품절"}{" "}
                    {stock.stock}개
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Price Comparison & AI Analysis - Only in LOOKUP mode */}
          {mode === "LOOKUP" && (
            <div className="space-y-3">
              <PriceComparisonCard
                barcode={product.barcode}
                ourPrice={product.sellPrice}
              />
              <AIInsightsCard barcode={product.barcode} />
            </div>
          )}

          {/* Action Modes */}
          {mode === "INBOUND" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold">입고 처리</h4>
              <div className="space-y-2">
                <Label htmlFor="quantity">입고 수량</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="text-center"
                    placeholder="수량 입력"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <Button
                onClick={handleInventoryAction}
                disabled={loading || !selectedCenter}
                className="w-full"
              >
                {loading ? "처리 중..." : "입고 완료"}
              </Button>
            </div>
          )}

          {mode === "OUTBOUND" && (
            <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
              <h4 className="font-semibold">출고 처리</h4>
              <div className="space-y-2">
                <Label htmlFor="quantity">출고 수량</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="text-center"
                    placeholder="수량 입력"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <Button
                onClick={handleInventoryAction}
                disabled={loading || !selectedCenter}
                variant="destructive"
                className="w-full"
              >
                {loading ? "처리 중..." : "출고 완료"}
              </Button>
            </div>
          )}

          {/* 계속 스캔 버튼 — 입고/출고 완료 후 표시 */}
          {actionCompleted && mode !== "LOOKUP" && (
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  setActionCompleted(false);
                  onClose();
                }}
                variant="outline"
                className="gap-2"
              >
                <ScanLine className="h-4 w-4" />
                계속 스캔
              </Button>
            </div>
          )}

          {mode === "LOOKUP" && (
            <div className="space-y-4">
              {/* 주문 입력 폼 (PDF p5: 바코드 스캔 후 바로 주문 접수) */}
              {showOrderForm && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    주문 접수
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="orderQty">수량</Label>
                      <Input
                        id="orderQty"
                        type="number"
                        min={1}
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <Label>공급가</Label>
                      <div className="text-sm font-medium pt-2">
                        {(product.supplyPrice * orderQuantity).toLocaleString()}원
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="orderRecipient">수령자명</Label>
                    <Input
                      id="orderRecipient"
                      value={orderRecipient}
                      onChange={(e) => setOrderRecipient(e.target.value)}
                      placeholder="수령자명 (선택)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orderPhone">연락처</Label>
                    <Input
                      id="orderPhone"
                      value={orderPhone}
                      onChange={(e) => setOrderPhone(e.target.value)}
                      placeholder="010-1234-1234 (선택)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleQuickOrder}
                      disabled={orderLoading}
                      className="flex-1"
                    >
                      {orderLoading ? "접수 중..." : "주문 접수"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowOrderForm(false)}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button onClick={onClose} variant="outline">닫기</Button>
                {!showOrderForm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowOrderForm(true)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    주문 접수
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose();
                    router.push("/broadcasts/calendar");
                  }}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <Radio className="mr-2 h-4 w-4" />
                  방송 시작
                </Button>
                <Link href={`/admin/products/${product.id}`}>
                  <Button>
                    상세 정보 보기
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
