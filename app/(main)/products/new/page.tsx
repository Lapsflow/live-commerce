"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiCrud } from "@/hooks/use-api-crud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ProductType = "HEADQUARTERS" | "CENTER";

interface Center {
  id: string;
  code: string;
  name: string;
  regionName: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const { create } = useApiCrud("/api/products");

  const [isLoading, setIsLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);

  // Form state
  const [productType, setProductType] = useState<ProductType>("HEADQUARTERS");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");
  const [managedBy, setManagedBy] = useState("");
  const [stockMujin, setStockMujin] = useState("");
  const [stock1, setStock1] = useState("");
  const [stock2, setStock2] = useState("");
  const [stock3, setStock3] = useState("");

  // Fetch centers for CENTER product type
  useEffect(() => {
    async function fetchCenters() {
      setLoadingCenters(true);
      try {
        const res = await fetch("/api/centers");
        if (res.ok) {
          const data = await res.json();
          setCenters(data.centers || []);
        }
      } catch (error) {
        console.error("Failed to load centers:", error);
      } finally {
        setLoadingCenters(false);
      }
    }

    if (productType === "CENTER") {
      fetchCenters();
    }
  }, [productType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validation
      if (!code.trim()) {
        toast.error("상품코드를 입력하세요");
        return;
      }
      if (!name.trim()) {
        toast.error("상품명을 입력하세요");
        return;
      }

      // WMS product validation
      if (productType === "HEADQUARTERS" && !barcode.trim()) {
        toast.error("본사(WMS) 상품은 바코드가 필수입니다");
        return;
      }

      // CENTER product validation
      if (productType === "CENTER" && !managedBy) {
        toast.error("센터 자사몰 상품은 관리 센터를 선택해야 합니다");
        return;
      }

      const sellPriceNum = parseInt(sellPrice) || 0;
      const supplyPriceNum = parseInt(supplyPrice) || 0;

      if (sellPriceNum < 0 || supplyPriceNum < 0) {
        toast.error("가격은 0 이상이어야 합니다");
        return;
      }

      const payload = {
        code: code.trim(),
        name: name.trim(),
        barcode: barcode.trim() || "",
        sellPrice: sellPriceNum,
        supplyPrice: supplyPriceNum,
        productType,
        managedBy: productType === "CENTER" ? managedBy : undefined,
        stockMujin: parseInt(stockMujin) || 0,
        stock1: parseInt(stock1) || 0,
        stock2: parseInt(stock2) || 0,
        stock3: parseInt(stock3) || 0,
      };

      const result = await create(payload);
      if (result) {
        router.push("/products");
      }
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">상품 추가</h1>
          <p className="text-muted-foreground">새로운 상품을 등록합니다</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>상품 정보</CardTitle>
          <CardDescription>상품 유형을 선택하고 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Type Selection */}
            <div className="space-y-2">
              <Label>상품 유형 *</Label>
              <RadioGroup
                value={productType}
                onValueChange={(value) => setProductType(value as ProductType)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="HEADQUARTERS" id="type-wms" />
                  <Label htmlFor="type-wms" className="font-normal cursor-pointer">
                    본사 WMS (슈퍼무진 관리)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CENTER" id="type-center" />
                  <Label htmlFor="type-center" className="font-normal cursor-pointer">
                    센터 자사몰 (센터 관리)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-sm text-muted-foreground">
                {productType === "HEADQUARTERS"
                  ? "본사 WMS 상품은 바코드가 필수이며 가격은 읽기 전용입니다"
                  : "센터 자사몰 상품은 센터별로 관리되며 가격 수정이 가능합니다"}
              </p>
            </div>

            {/* Center Selection (CENTER only) */}
            {productType === "CENTER" && (
              <div className="space-y-2">
                <Label htmlFor="managedBy">관리 센터 *</Label>
                <Select value={managedBy} onValueChange={setManagedBy} disabled={loadingCenters}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCenters ? "로딩 중..." : "센터를 선택하세요"} />
                  </SelectTrigger>
                  <SelectContent>
                    {centers.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name} ({center.regionName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">상품코드 *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: PROD-001"
                maxLength={50}
                required
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">상품명 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 삼성 갤럭시 S24"
                maxLength={200}
                required
              />
            </div>

            {/* Barcode */}
            <div className="space-y-2">
              <Label htmlFor="barcode">
                바코드 {productType === "HEADQUARTERS" && "*"}
              </Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="예: 8801234567890"
                maxLength={50}
                required={productType === "HEADQUARTERS"}
              />
              {productType === "HEADQUARTERS" && (
                <p className="text-sm text-muted-foreground">본사 WMS 상품은 바코드가 필수입니다</p>
              )}
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sellPrice">판매가 *</Label>
                <div className="relative">
                  <Input
                    id="sellPrice"
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0"
                    min="0"
                    readOnly={productType === "HEADQUARTERS"}
                    className={productType === "HEADQUARTERS" ? "bg-gray-100" : ""}
                    required
                  />
                  {productType === "HEADQUARTERS" && (
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {productType === "HEADQUARTERS" && (
                  <p className="text-sm text-muted-foreground">WMS 상품은 가격 수정이 불가합니다</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplyPrice">공급가 *</Label>
                <div className="relative">
                  <Input
                    id="supplyPrice"
                    type="number"
                    value={supplyPrice}
                    onChange={(e) => setSupplyPrice(e.target.value)}
                    placeholder="0"
                    min="0"
                    readOnly={productType === "HEADQUARTERS"}
                    className={productType === "HEADQUARTERS" ? "bg-gray-100" : ""}
                    required
                  />
                  {productType === "HEADQUARTERS" && (
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Stock */}
            <div className="space-y-4">
              <Label>재고 수량</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockMujin" className="text-sm font-normal">
                    슈퍼무진 재고
                  </Label>
                  <Input
                    id="stockMujin"
                    type="number"
                    value={stockMujin}
                    onChange={(e) => setStockMujin(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock1" className="text-sm font-normal">
                    1센터 재고
                  </Label>
                  <Input
                    id="stock1"
                    type="number"
                    value={stock1}
                    onChange={(e) => setStock1(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock2" className="text-sm font-normal">
                    2센터 재고
                  </Label>
                  <Input
                    id="stock2"
                    type="number"
                    value={stock2}
                    onChange={(e) => setStock2(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock3" className="text-sm font-normal">
                    3센터 재고
                  </Label>
                  <Input
                    id="stock3"
                    type="number"
                    value={stock3}
                    onChange={(e) => setStock3(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-2 justify-end">
              <Link href="/products">
                <Button type="button" variant="outline">
                  취소
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "등록 중..." : "등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
