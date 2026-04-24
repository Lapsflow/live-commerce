"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search, Settings, Package } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

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

const statusLabels: Record<string, string> = {
  CONTINUOUS: "꾸준한 제품",
  UNTIL_SOLD: "소진후 종료",
};

interface Product {
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

export default function SampleManagePage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sample" | "not_sample">("all");

  // 설정 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editIsSample, setEditIsSample] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const userRole = (session?.user as any)?.role;

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "200" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/products?${params.toString()}`);
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
  }, [search]);

  const filteredProducts = products.filter((p) => {
    if (filterType === "sample") return p.isSample;
    if (filterType === "not_sample") return !p.isSample;
    return true;
  });

  const openEditModal = (product: Product) => {
    setEditProduct(product);
    setEditIsSample(product.isSample);
    setEditCategory(product.sampleCategory || "");
    setEditPrice(product.samplePrice !== null ? String(product.samplePrice) : "0");
    setEditStatus(product.sampleStatus || "CONTINUOUS");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editProduct) return;

    setSaving(true);
    try {
      const res = await fetch("/api/samples", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editProduct.id,
          isSample: editIsSample,
          sampleCategory: editIsSample ? editCategory || null : null,
          samplePrice: editIsSample ? parseInt(editPrice) || 0 : null,
          sampleStatus: editIsSample ? editStatus || null : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "저장 실패");
      }

      toast({ title: "저장 완료" });
      setEditOpen(false);
      loadProducts();
    } catch (err: any) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // MASTER/SUB_MASTER만 접근
  if (userRole && userRole !== "MASTER" && userRole !== "SUB_MASTER") {
    return (
      <div className="container mx-auto py-6 text-center">
        <p className="text-muted-foreground">MASTER 또는 SUB_MASTER만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/samples">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">샘플 관리</h1>
          <p className="text-muted-foreground">
            상품을 샘플로 지정하고 카테고리, 가격, 상태를 설정합니다
          </p>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {products.filter((p) => p.isSample).length}
            </div>
            <p className="text-sm text-muted-foreground">샘플 지정 상품</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {products.filter((p) => p.isSample && (p.samplePrice === 0 || p.samplePrice === null)).length}
            </div>
            <p className="text-sm text-muted-foreground">무료 샘플</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {products.filter((p) => p.isSample && p.samplePrice && p.samplePrice > 0).length}
            </div>
            <p className="text-sm text-muted-foreground">유료 샘플</p>
          </CardContent>
        </Card>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="상품명, 바코드, 상품코드 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
          >
            전체
          </Button>
          <Button
            variant={filterType === "sample" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("sample")}
          >
            샘플 지정
          </Button>
          <Button
            variant={filterType === "not_sample" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("not_sample")}
          >
            미지정
          </Button>
        </div>
      </div>

      {/* 상품 목록 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">상품명</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">상품코드</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">유형</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">샘플</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">카테고리</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">샘플가</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">상태</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">재고</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">설정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        상품이 없습니다
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 max-w-[200px] truncate">{p.name}</td>
                        <td className="px-4 py-3 font-mono">{p.code}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {p.productType === "HEADQUARTERS" ? "본사" : "센터"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.isSample ? (
                            <Badge className="bg-green-100 text-green-700">ON</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-400">OFF</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.sampleCategory
                            ? categoryLabels[p.sampleCategory] || p.sampleCategory
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.isSample
                            ? p.samplePrice === 0 || p.samplePrice === null
                              ? <span className="text-green-600 font-medium">무료</span>
                              : <span className="text-blue-600 font-medium">{p.samplePrice!.toLocaleString()}원</span>
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {p.sampleStatus
                            ? statusLabels[p.sampleStatus] || p.sampleStatus
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={p.totalStock < 10 ? "text-red-600 font-medium" : ""}>
                            {p.totalStock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(p)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 설정 모달 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>샘플 설정</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{editProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  {editProduct.code} | 정가: {editProduct.sellPrice.toLocaleString()}원
                </p>
              </div>

              {/* 샘플 ON/OFF */}
              <div className="flex items-center justify-between">
                <Label>샘플 지정</Label>
                <Switch
                  checked={editIsSample}
                  onCheckedChange={setEditIsSample}
                />
              </div>

              {editIsSample && (
                <>
                  {/* 카테고리 */}
                  <div className="space-y-2">
                    <Label>카테고리</Label>
                    <Select
                      value={editCategory}
                      onValueChange={(v) => v && setEditCategory(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 샘플 가격 */}
                  <div className="space-y-2">
                    <Label>샘플 가격 (0 = 무료)</Label>
                    <Input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      0원: 무료 샘플 / 금액 입력: 유료 샘플
                    </p>
                  </div>

                  {/* 상태 */}
                  <div className="space-y-2">
                    <Label>상품 상태</Label>
                    <Select
                      value={editStatus}
                      onValueChange={(v) => v && setEditStatus(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="상태 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONTINUOUS">꾸준한 제품</SelectItem>
                        <SelectItem value="UNTIL_SOLD">소진후 종료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
