"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiCrud } from "@/hooks/use-api-crud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityHistory } from "@/components/audit/entity-history";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Lock, Pencil, Trash2, Save, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";

interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  originalPrice?: number | null;
  totalStock: number;
  stockMujin: number;
  stock1: number;
  stock2: number;
  stock3: number;
  productType: "HEADQUARTERS" | "CENTER";
  managedBy?: string;
  category?: string | null;
  notes?: string | null;
  registeredBy?: string | null;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Center {
  id: string;
  name: string;
  regionName: string;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userCenterId = (session?.user as any)?.centerId;
  const isMaster = userRole === "MASTER";
  const { update, remove } = useApiCrud("/api/products");

  const [productId, setProductId] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");
  const [originalPriceEdit, setOriginalPriceEdit] = useState("");
  const [managedBy, setManagedBy] = useState("");
  const [stockMujin, setStockMujin] = useState("");
  const [stock1, setStock1] = useState("");
  const [stock2, setStock2] = useState("");
  const [stock3, setStock3] = useState("");
  const [categoryEdit, setCategoryEdit] = useState("");
  const [notesEdit, setNotesEdit] = useState("");

  // CENTER 상품은 SUB_MASTER/ADMIN도 가격 수정 가능
  const canEditPrice = isMaster || (
    product?.productType === "CENTER" &&
    (userRole === "SUB_MASTER" || userRole === "ADMIN") &&
    product?.managedBy === userCenterId
  );

  // SUB_MASTER/ADMIN: 본인 센터 상품만 수정 가능
  const canEdit = isMaster || (
    (userRole === "SUB_MASTER" || userRole === "ADMIN") &&
    product?.productType === "CENTER" &&
    product?.managedBy === userCenterId
  );

  // Extract params
  useEffect(() => {
    params.then((p) => setProductId(p.id));
  }, [params]);

  // Fetch product data
  useEffect(() => {
    if (!productId) return;

    async function fetchProduct() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          toast.error("상품을 불러오는데 실패했습니다");
          return;
        }
        const data = await res.json();
        const productData = data.data;
        setProduct(productData);

        // Initialize form state
        setCode(productData.code);
        setName(productData.name);
        setBarcode(productData.barcode);
        setSellPrice(String(productData.sellPrice));
        setSupplyPrice(String(productData.supplyPrice));
        setManagedBy(productData.managedBy || "");
        setOriginalPriceEdit(String(productData.originalPrice || ""));
        setStockMujin(String(productData.stockMujin));
        setStock1(String(productData.stock1));
        setStock2(String(productData.stock2));
        setStock3(String(productData.stock3));
        setCategoryEdit(productData.category || "");
        setNotesEdit(productData.notes || "");
      } catch (error) {
        console.error("Failed to load product:", error);
        toast.error("상품을 불러오는데 실패했습니다");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProduct();
  }, [productId]);

  // Fetch centers for CENTER products
  useEffect(() => {
    if (!product || product.productType !== "CENTER") return;

    async function fetchCenters() {
      try {
        const res = await fetch("/api/centers");
        if (res.ok) {
          const data = await res.json();
          setCenters(data.centers || []);
        }
      } catch (error) {
        console.error("Failed to load centers:", error);
      }
    }

    fetchCenters();
  }, [product]);

  const handleSave = async () => {
    if (!product) return;

    setIsSaving(true);
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
      if (product.productType === "HEADQUARTERS" && !barcode.trim()) {
        toast.error("본사(WMS) 상품은 바코드가 필수입니다");
        return;
      }

      // CENTER product validation
      if (product.productType === "CENTER" && !managedBy) {
        toast.error("센터 자사몰 상품은 관리 센터를 선택해야 합니다");
        return;
      }

      const sellPriceNum = parseInt(sellPrice) || 0;
      const supplyPriceNum = parseInt(supplyPrice) || 0;

      if (sellPriceNum < 0 || supplyPriceNum < 0) {
        toast.error("가격은 0 이상이어야 합니다");
        return;
      }

      // CENTER 상품 가격 0원 차단
      if (product.productType === "CENTER") {
        if (sellPriceNum <= 0) {
          toast.error("센터 상품의 판매가는 0보다 커야 합니다");
          return;
        }
        if (supplyPriceNum <= 0) {
          toast.error("센터 상품의 공급가는 0보다 커야 합니다");
          return;
        }
      }

      const payload: Record<string, unknown> = {
        code: code.trim(),
        name: name.trim(),
        barcode: barcode.trim() || "",
        managedBy: product.productType === "CENTER" ? managedBy : undefined,
        stockMujin: parseInt(stockMujin) || 0,
        stock1: parseInt(stock1) || 0,
        stock2: parseInt(stock2) || 0,
        stock3: parseInt(stock3) || 0,
        category: categoryEdit || null,
        notes: notesEdit.trim() || null,
      };

      // 가격은 권한 있을 때만 전송
      if (canEditPrice) {
        payload.sellPrice = sellPriceNum;
        payload.supplyPrice = supplyPriceNum;
        if (originalPriceEdit) {
          payload.originalPrice = parseInt(originalPriceEdit) || 0;
        }
      }

      const result = await update(productId, payload);
      if (result) {
        setProduct(result as unknown as Product);
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    const reason = prompt("비활성화 사유를 입력하세요:");
    if (!reason || !reason.trim()) {
      toast.error("비활성화 사유를 입력해야 합니다");
      return;
    }

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        toast.success("상품이 비활성화되었습니다");
        router.push("/products");
      } else {
        toast.error("비활성화에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    }
  };

  const handleReactivate = async () => {
    if (!confirm("이 상품을 다시 활성화하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(data.data);
        toast.success("상품이 활성화되었습니다");
      } else {
        toast.error("활성화에 실패했습니다");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
    }
  };

  const handleCancel = () => {
    if (!product) return;

    // Reset form to original values
    setCode(product.code);
    setName(product.name);
    setBarcode(product.barcode);
    setSellPrice(String(product.sellPrice));
    setSupplyPrice(String(product.supplyPrice));
    setManagedBy(product.managedBy || "");
    setOriginalPriceEdit(String(product.originalPrice || ""));
    setStockMujin(String(product.stockMujin));
    setStock1(String(product.stock1));
    setStock2(String(product.stock2));
    setStock3(String(product.stock3));
    setCategoryEdit(product.category || "");
    setNotesEdit(product.notes || "");
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">상품을 찾을 수 없습니다</p>
        <Link href="/products">
          <Button>목록으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">상품 상세</h1>
            <p className="text-muted-foreground">상품 정보를 확인하고 수정합니다</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              {canEdit && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  수정
                </Button>
              )}
              {canEdit && (product?.isActive !== false ? (
                <Button variant="destructive" onClick={handleDeactivate}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  비활성화
                </Button>
              ) : (
                <Button variant="outline" className="text-green-600 border-green-300" onClick={handleReactivate}>
                  활성화
                </Button>
              ))}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                취소
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "저장 중..." : "저장"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>상품 정보</CardTitle>
            <Badge
              variant="outline"
              className={
                product.productType === "HEADQUARTERS"
                  ? "bg-blue-500/10 text-blue-700"
                  : "bg-purple-500/10 text-purple-700"
              }
            >
              {product.productType === "HEADQUARTERS" ? "본사 WMS" : "센터 자사몰"}
            </Badge>
          </div>
          <CardDescription>
            {product.productType === "HEADQUARTERS"
              ? "본사 WMS 상품은 바코드가 필수입니다"
              : "센터 자사몰 상품은 센터별로 관리됩니다"}
            {!isMaster && " (가격은 마스터만 변경 가능)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">상품코드</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!isEditing}
                maxLength={50}
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">상품명</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing}
                maxLength={200}
              />
            </div>

            {/* Barcode */}
            <div className="space-y-2">
              <Label htmlFor="barcode">
                바코드 {product.productType === "HEADQUARTERS" && "*"}
              </Label>
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={!isEditing}
                maxLength={50}
              />
              {product.productType === "HEADQUARTERS" && (
                <p className="text-sm text-muted-foreground">본사 WMS 상품은 바코드가 필수입니다</p>
              )}
            </div>

            {/* Managed By (CENTER only) */}
            {product.productType === "CENTER" && (
              <div className="space-y-2">
                <Label>관리 센터</Label>
                {isEditing ? (
                  <select
                    value={managedBy}
                    onChange={(e) => setManagedBy(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="">센터를 선택하세요</option>
                    {centers.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name} ({center.regionName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={
                      centers.find((c) => c.id === managedBy)?.name || managedBy || "미지정"
                    }
                    disabled
                  />
                )}
              </div>
            )}

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              {/* 원가 — MASTER 전용 */}
              {isMaster && (
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="originalPrice">원가</Label>
                  {isEditing && product.productType === "CENTER" ? (
                    <Input
                      id="originalPrice"
                      type="number"
                      value={originalPriceEdit}
                      onChange={(e) => setOriginalPriceEdit(e.target.value)}
                      min="0"
                      className="bg-amber-50 dark:bg-amber-950/20"
                    />
                  ) : (
                    <Input
                      value={product.originalPrice != null ? product.originalPrice.toLocaleString() : "-"}
                      disabled
                      className="bg-amber-50 dark:bg-amber-950/20"
                    />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {product.productType === "HEADQUARTERS" ? "ONEWMS org_price 자동 동기화" : "등록자 직접 입력"}
                    {product.supplyPrice > 0 && product.originalPrice != null && product.originalPrice > 0 && (
                      <> | 마진율: {((1 - product.originalPrice / product.supplyPrice) * 100).toFixed(1)}%</>
                    )}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="sellPrice">판매가</Label>
                <div className="relative">
                  <Input
                    id="sellPrice"
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    disabled={!isEditing || !canEditPrice}
                    className={!canEditPrice ? "bg-grey-100" : ""}
                    min="0"
                  />
                  {!canEditPrice && (
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {!canEditPrice && (
                  <p className="text-sm text-muted-foreground">
                    {product.productType === "HEADQUARTERS" ? "본사 상품 가격은 ONEWMS에서 동기화됩니다" : "가격은 마스터만 변경 가능합니다"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplyPrice">공급가</Label>
                <div className="relative">
                  <Input
                    id="supplyPrice"
                    type="number"
                    value={supplyPrice}
                    onChange={(e) => setSupplyPrice(e.target.value)}
                    disabled={!isEditing || !canEditPrice}
                    className={!canEditPrice ? "bg-grey-100" : ""}
                    min="0"
                  />
                  {!canEditPrice && (
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
                    min="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-normal">총 재고</Label>
                <Input value={product.totalStock} disabled />
              </div>
            </div>

            {/* Category & Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>카테고리</Label>
                {isEditing ? (
                  <Select value={categoryEdit} onValueChange={(v) => setCategoryEdit(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">미설정</SelectItem>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={product.category || "미설정"} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>메모</Label>
                {isEditing ? (
                  <Textarea
                    value={notesEdit}
                    onChange={(e) => setNotesEdit(e.target.value)}
                    maxLength={500}
                    rows={2}
                  />
                ) : (
                  <Input value={product.notes || "-"} disabled />
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">생성일</Label>
                <p className="text-sm">{new Date(product.createdAt).toLocaleString("ko-KR")}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">수정일</Label>
                <p className="text-sm">{new Date(product.updatedAt).toLocaleString("ko-KR")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">변경 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityHistory entityType="Product" entityId={product.id} />
        </CardContent>
      </Card>
    </div>
  );
}
