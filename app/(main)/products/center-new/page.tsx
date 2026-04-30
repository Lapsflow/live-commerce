"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";

export default function CenterNewProductPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "SELLER";
  const userCenterId = (session?.user as any)?.centerId;
  const centerInfo = (session?.user as any)?.center;

  // 권한 체크: SUB_MASTER, ADMIN만
  const canAccess = userRole === "MASTER" || userRole === "SUB_MASTER" || userRole === "ADMIN";

  const [isLoading, setIsLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);

  // MASTER용: 센터 목록
  const [centers, setCenters] = useState<Array<{ id: string; code: string; name: string; regionName: string }>>([]);
  const [selectedCenterId, setSelectedCenterId] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [totalStock, setTotalStock] = useState("");
  const [notes, setNotes] = useState("");

  const effectiveCenterId = userRole === "MASTER" ? selectedCenterId : userCenterId;

  // MASTER: 센터 목록 로드
  useEffect(() => {
    if (userRole === "MASTER") {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((data) => setCenters(data.centers || []))
        .catch(() => {});
    }
  }, [userRole]);

  // 코드 미리보기 로드
  useEffect(() => {
    if (!effectiveCenterId) {
      setPreviewCode("");
      return;
    }

    setLoadingCode(true);
    fetch(`/api/products/center-code?centerId=${effectiveCenterId}`)
      .then((r) => r.json())
      .then((data) => setPreviewCode(data.code || ""))
      .catch(() => setPreviewCode(""))
      .finally(() => setLoadingCode(false));
  }, [effectiveCenterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCenterId) {
      toast.error("센터를 선택해주세요");
      return;
    }
    if (!name.trim()) {
      toast.error("상품명을 입력하세요");
      return;
    }
    if (!barcode.trim()) {
      toast.error("바코드를 입력하세요");
      return;
    }

    const sellPriceNum = parseInt(sellPrice) || 0;
    const supplyPriceNum = parseInt(supplyPrice) || 0;
    const originalPriceNum = parseInt(originalPrice) || 0;

    if (sellPriceNum <= 0) {
      toast.error("판매가는 0보다 커야 합니다");
      return;
    }
    if (supplyPriceNum <= 0) {
      toast.error("공급가는 0보다 커야 합니다");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          barcode: barcode.trim(),
          sellPrice: sellPriceNum,
          supplyPrice: supplyPriceNum,
          originalPrice: originalPriceNum || undefined,
          totalStock: parseInt(totalStock) || 0,
          productType: "CENTER",
          managedBy: effectiveCenterId,
          category: category || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.message || result.error || "등록 실패");
        return;
      }

      toast.success("센터 상품이 등록되었습니다");
      router.push("/products");
    } catch {
      toast.error("상품 등록 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h2 className="text-xl font-semibold">접근 권한이 없습니다</h2>
        <p className="text-muted-foreground">
          센터 상품 등록은 전체관리자, 관리자만 가능합니다.
        </p>
        <Link href="/products">
          <Button variant="outline">상품 목록으로</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">센터 상품 등록</h1>
          <p className="text-muted-foreground">
            센터 자사몰 상품을 등록합니다. 배송 및 사고 책임은 센터에 있습니다.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>상품 정보</CardTitle>
          <CardDescription>
            센터 상품은 ONEWMS와 무관하며, 센터가 직접 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* MASTER: 센터 선택 / SUB_MASTER,ADMIN: 본인 센터 표시 */}
            <div className="space-y-2">
              <Label>소속 센터 *</Label>
              {userRole === "MASTER" ? (
                <Select
                  value={selectedCenterId}
                  onValueChange={(v) => setSelectedCenterId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="센터를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.regionName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>{centerInfo?.name || "센터 미배정"}</span>
                </div>
              )}
            </div>

            {/* 상품코드 미리보기 */}
            <div className="space-y-2">
              <Label>상품코드 (자동 생성)</Label>
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted">
                <Lock className="h-4 w-4 text-muted-foreground" />
                {loadingCode ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="font-mono">
                    {previewCode || "센터 선택 후 자동 생성됩니다"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                [C센터번호-순번] 형식으로 자동 부여됩니다
              </p>
            </div>

            {/* 상품명 */}
            <div className="space-y-2">
              <Label htmlFor="name">상품명 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 유기농 사과즙"
                maxLength={200}
                required
              />
            </div>

            {/* 바코드 */}
            <div className="space-y-2">
              <Label htmlFor="barcode">바코드 *</Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="제품 뒷면 GS1 바코드 (예: 8801234567890)"
                maxLength={50}
                required
              />
              <p className="text-xs text-muted-foreground">
                기존 상품과 중복되지 않는 고유 바코드
              </p>
            </div>

            {/* 카테고리 */}
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 가격 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sellPrice">판매가 *</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0"
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplyPrice">공급가 *</Label>
                <Input
                  id="supplyPrice"
                  type="number"
                  value={supplyPrice}
                  onChange={(e) => setSupplyPrice(e.target.value)}
                  placeholder="0"
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="originalPrice">원가</Label>
                <Input
                  id="originalPrice"
                  type="number"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-4">
              판매가와 공급가는 0원을 입력할 수 없습니다
            </p>

            {/* 재고 */}
            <div className="space-y-2">
              <Label htmlFor="totalStock">재고 수량</Label>
              <Input
                id="totalStock"
                type="number"
                value={totalStock}
                onChange={(e) => setTotalStock(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="notes">메모</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="상품 관련 메모 (선택사항)"
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2 justify-end">
              <Link href="/products">
                <Button type="button" variant="outline">
                  취소
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isLoading || !effectiveCenterId}
              >
                {isLoading ? "등록 중..." : "센터 상품 등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
