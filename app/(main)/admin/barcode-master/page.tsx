"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Edit, X } from "lucide-react";
import { useSession } from "next-auth/react";

interface BarcodeMaster {
  id: string;
  barcode: string;
  standardName: string;
  category?: string;
  manufacturer?: string;
  specifications?: string;
  isActive: boolean;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function BarcodeMasterPage() {
  const { data: session } = useSession();
  const [barcodes, setBarcodes] = useState<BarcodeMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    barcode: "",
    standardName: "",
    category: "",
    manufacturer: "",
    specifications: "",
  });

  useEffect(() => {
    fetchBarcodes();
  }, [search]);

  const fetchBarcodes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("isActive", "true");

      const res = await fetch(`/api/barcode-master?${params}`);
      const data = await res.json();
      setBarcodes(data.data || []);
    } catch (error) {
      console.error("Failed to fetch barcodes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, ...formData }
        : formData;

      const res = await fetch("/api/barcode-master", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to save barcode");
        return;
      }

      alert(editingId ? "바코드가 수정되었습니다" : "바코드가 등록되었습니다");
      setShowForm(false);
      setEditingId(null);
      setFormData({
        barcode: "",
        standardName: "",
        category: "",
        manufacturer: "",
        specifications: "",
      });
      fetchBarcodes();
    } catch (error) {
      console.error("Failed to save barcode:", error);
      alert("오류가 발생했습니다");
    }
  };

  const handleEdit = (barcode: BarcodeMaster) => {
    setEditingId(barcode.id);
    setFormData({
      barcode: barcode.barcode,
      standardName: barcode.standardName,
      category: barcode.category || "",
      manufacturer: barcode.manufacturer || "",
      specifications: barcode.specifications || "",
    });
    setShowForm(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("이 바코드를 비활성화하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/barcode-master?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Failed to deactivate barcode");
        return;
      }

      alert("바코드가 비활성화되었습니다");
      fetchBarcodes();
    } catch (error) {
      console.error("Failed to deactivate barcode:", error);
      alert("오류가 발생했습니다");
    }
  };

  // Only MASTER role can access this page
  if (session?.user?.role !== "MASTER") {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">접근 권한 없음</h1>
          <p className="text-muted-foreground">
            바코드 마스터 관리는 MASTER 권한이 필요합니다.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">공식 바코드 마스터 관리</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              취소
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              바코드 등록
            </>
          )}
        </Button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <Card className="p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? "바코드 수정" : "새 바코드 등록"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  바코드 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, barcode: e.target.value })
                  }
                  placeholder="8801234567890"
                  disabled={!!editingId}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  공식 상품명 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.standardName}
                  onChange={(e) =>
                    setFormData({ ...formData, standardName: e.target.value })
                  }
                  placeholder="상품의 공식 명칭"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">카테고리</label>
                <Input
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="식품, 가전, 의류 등"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">제조사</label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) =>
                    setFormData({ ...formData, manufacturer: e.target.value })
                  }
                  placeholder="제조사명"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">규격/사양</label>
                <Input
                  value={formData.specifications}
                  onChange={(e) =>
                    setFormData({ ...formData, specifications: e.target.value })
                  }
                  placeholder="용량, 크기, 색상 등"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    barcode: "",
                    standardName: "",
                    category: "",
                    manufacturer: "",
                    specifications: "",
                  });
                }}
              >
                취소
              </Button>
              <Button type="submit">
                {editingId ? "수정" : "등록"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Search Bar */}
      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <Search className="h-5 w-5 text-muted-foreground self-center" />
          <Input
            type="text"
            placeholder="바코드, 상품명, 카테고리, 제조사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {/* Barcode Master List */}
      <Card className="p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">등록된 바코드 마스터</h2>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            로딩 중...
          </div>
        ) : barcodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            등록된 바코드가 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2">
                  <th className="text-left py-3 px-2 font-semibold">바코드</th>
                  <th className="text-left py-3 px-2 font-semibold">공식 상품명</th>
                  <th className="text-left py-3 px-2 font-semibold">카테고리</th>
                  <th className="text-left py-3 px-2 font-semibold">제조사</th>
                  <th className="text-left py-3 px-2 font-semibold">등록일</th>
                  <th className="text-center py-3 px-2 font-semibold">작업</th>
                </tr>
              </thead>
              <tbody>
                {barcodes.map((barcode) => (
                  <tr key={barcode.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-mono text-sm">
                      {barcode.barcode}
                    </td>
                    <td className="py-3 px-2 font-medium">{barcode.standardName}</td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {barcode.category || "-"}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {barcode.manufacturer || "-"}
                    </td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">
                      {new Date(barcode.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(barcode)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeactivate(barcode.id)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          비활성화
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
