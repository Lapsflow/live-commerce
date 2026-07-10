"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Store,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";

interface CenterStat {
  centerId: string;
  centerName: string;
  centerCode: string;
  centerNumber: string | null;
  regionName: string;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  categories: { category: string; count: number }[];
}

interface SummaryTotals {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  centerCount: number;
}

interface CenterProduct {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  originalPrice: number | null;
  totalStock: number;
  category: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  managedBy: string | null;
  center: { id: string; name: string; code: string } | null;
}

export default function CenterProductsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;

  // Summary data
  const [centerStats, setCenterStats] = useState<CenterStat[]>([]);
  const [totals, setTotals] = useState<SummaryTotals>({
    totalCount: 0,
    activeCount: 0,
    inactiveCount: 0,
    centerCount: 0,
  });

  // Product list
  const [products, setProducts] = useState<CenterProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 50;

  // Filters
  const [centerId, setCenterId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Load summary
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/center-products?mode=summary");
      const json = await res.json();
      // 2026-07-10 수정: ok() 응답엔 success 필드가 없어 요약이 항상 비어 있었음
      if (res.ok && json.data?.totals) {
        setCenterStats(json.data.centers ?? []);
        setTotals(json.data.totals);
      }
    } catch (err) {
      console.error("Summary load error:", err);
    }
  }, []);

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageIndex", String(pageIndex));
      params.set("pageSize", String(pageSize));
      if (centerId) params.set("centerId", centerId);
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (showInactive) params.set("showInactive", "true");

      const res = await fetch(`/api/admin/center-products?${params}`);
      const json = await res.json();

      // 2026-07-10 수정: paginated() 응답엔 success 필드가 없어 목록이 항상 비어 있었음
      if (res.ok) {
        setProducts(json.data ?? []);
        setTotal(json.totalCount ?? 0);
      }
    } catch (err) {
      console.error("Products load error:", err);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, centerId, search, category, showInactive]);

  useEffect(() => {
    if (userRole === "MASTER") {
      loadSummary();
    }
  }, [userRole, loadSummary]);

  useEffect(() => {
    if (userRole === "MASTER") {
      loadProducts();
    }
  }, [userRole, loadProducts]);

  const handleSearch = () => {
    setPageIndex(0);
    loadProducts();
  };

  const handleReset = () => {
    setCenterId("");
    setSearch("");
    setCategory("");
    setShowInactive(false);
    setPageIndex(0);
  };

  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    params.set("pageIndex", "0");
    params.set("pageSize", "10000");
    if (centerId) params.set("centerId", centerId);
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (showInactive) params.set("showInactive", "true");

    const res = await fetch(`/api/admin/center-products?${params}`);
    const json = await res.json();
    if (!res.ok) return; // 2026-07-10: success 필드 없음 (paginated 응답)

    const rows = (json.data ?? []) as CenterProduct[];
    const csvHeader =
      "센터,상품코드,상품명,바코드,판매가,공급가,원가,재고,카테고리,상태,등록일\n";
    const csvRows = rows
      .map((p) =>
        [
          p.center?.name || "-",
          p.code,
          `"${p.name.replace(/"/g, '""')}"`,
          p.barcode,
          p.sellPrice,
          p.supplyPrice,
          p.originalPrice ?? "-",
          p.totalStock,
          p.category || "미분류",
          p.isActive ? "활성" : "비활성",
          new Date(p.createdAt).toLocaleDateString("ko-KR"),
        ].join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvHeader + csvRows], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `center-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (userRole !== "MASTER") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          접근 권한이 없습니다 (MASTER 전용)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          <h1 className="text-2xl font-bold">센터 상품 현황</h1>
          <Badge variant="secondary">{totals.totalCount}개</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              등록 센터
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.centerCount}개</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              전체 상품
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.totalCount}개</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              활성 상품
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {totals.activeCount}개
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              비활성 상품
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-500">
              {totals.inactiveCount}개
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Center Stats */}
      {centerStats.filter((c) => c.totalCount > 0).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">센터별 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {centerStats
                .filter((c) => c.totalCount > 0)
                .map((c) => (
                  <div
                    key={c.centerId}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer"
                    onClick={() => {
                      setCenterId(c.centerId);
                      setPageIndex(0);
                    }}
                  >
                    <div>
                      <p className="font-medium text-sm">{c.centerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.regionName} / {c.centerCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{c.activeCount}개</p>
                      {c.inactiveCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          +{c.inactiveCount} 비활성
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select
              value={centerId || "all"}
              onValueChange={(v) => {
                setCenterId(v === "all" ? "" : v ?? "");
                setPageIndex(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="센터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 센터</SelectItem>
                {centerStats.map((c) => (
                  <SelectItem key={c.centerId} value={c.centerId}>
                    {c.centerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="상품명/코드/바코드"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Select
              value={category || "all"}
              onValueChange={(v) => {
                setCategory(v === "all" ? "" : v ?? "");
                setPageIndex(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="미분류">미분류</SelectItem>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowInactive(!showInactive);
                setPageIndex(0);
              }}
              className="h-10"
            >
              {showInactive ? (
                <Eye className="mr-1 h-3 w-3" />
              ) : (
                <EyeOff className="mr-1 h-3 w-3" />
              )}
              {showInactive ? "비활성 포함" : "활성만"}
            </Button>
            <div className="flex gap-1">
              <Button onClick={handleSearch} size="sm" className="flex-1 h-10">
                <Search className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="h-10"
              >
                초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">로딩 중...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">
                센터 상품이 없습니다
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">센터</th>
                    <th className="text-left p-3 font-medium">상품코드</th>
                    <th className="text-left p-3 font-medium">상품명</th>
                    <th className="text-left p-3 font-medium">바코드</th>
                    <th className="text-right p-3 font-medium">판매가</th>
                    <th className="text-right p-3 font-medium">공급가</th>
                    <th className="text-right p-3 font-medium">재고</th>
                    <th className="text-left p-3 font-medium">카테고리</th>
                    <th className="text-left p-3 font-medium">상태</th>
                    <th className="text-left p-3 font-medium">등록일</th>
                    <th className="text-left p-3 font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-muted/30"
                    >
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {p.center?.name || "-"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{p.code}</td>
                      <td className="p-3 font-medium max-w-[200px] truncate">
                        {p.name}
                      </td>
                      <td className="p-3 font-mono text-xs">{p.barcode || "-"}</td>
                      <td className="p-3 text-right">
                        {p.sellPrice.toLocaleString()}원
                      </td>
                      <td className="p-3 text-right">
                        {p.supplyPrice.toLocaleString()}원
                      </td>
                      <td className="p-3 text-right">
                        <Badge
                          variant="outline"
                          className={
                            p.totalStock < 10
                              ? "bg-red-500/10 text-red-700"
                              : "bg-green-500/10 text-green-700"
                          }
                        >
                          {p.totalStock}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">
                        {p.category || "미분류"}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            p.isActive
                              ? "bg-green-500/10 text-green-700"
                              : "bg-gray-500/10 text-gray-500"
                          }
                        >
                          {p.isActive ? "활성" : "비활성"}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="p-3">
                        <Link href={`/products/${p.id}`}>
                          <Button variant="ghost" size="sm">
                            <Package className="h-3 w-3 mr-1" />
                            상세
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pageIndex * pageSize + 1}-
            {Math.min((pageIndex + 1) * pageSize, total)} / {total}개
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
