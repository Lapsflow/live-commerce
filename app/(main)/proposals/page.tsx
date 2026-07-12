"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
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
  ShoppingBag, Plus, ImageIcon, X, Loader2,
  Package, Repeat, Zap, AlertTriangle,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import dynamic from "next/dynamic";

const TipTapEditor = dynamic(() => import("@/components/editors/TipTapEditor"), {
  ssr: false,
  loading: () => <div className="border rounded-md p-3 min-h-[120px] bg-gray-50 text-sm text-muted-foreground">에디터 로딩 중...</div>,
});

type Proposal = {
  id: string;
  companyName: string;
  contact: string;
  phone: string;
  productName: string;
  category: string;
  subcategory?: string;
  description: string;
  status: string;
  imageMain?: string;
  imageSubs?: string;
  sampleType?: string;
  samplePrice?: number;
  brand?: string;
  productCode?: string;
  // PROPOSAL-07
  onlineLowestPrice?: number | null;
  supplyPrice?: number | null;
  expiryDate?: string | null;
  stockQty?: number | null;
  supplyType?: string | null;
  submittedBy: string;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
};

// PROPOSAL-04: 카테고리 구조
const CATEGORIES: Record<string, string[]> = {
  "식품": ["생활식품", "건강기능식품", "가공식품", "신선식품"],
  "뷰티": ["화장품", "헤어/바디", "향수"],
  "생활/주방": ["주방용품", "생활잡화", "청소용품"],
  "가전": ["소형가전", "주방가전", "미용가전"],
  "패션": ["의류", "잡화", "슈즈"],
  "기타": ["기타"],
};

const ALL_CATEGORIES = ["전체", ...Object.keys(CATEGORIES)];

// base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더용 맵 (2026-07-10)
const SAMPLE_TYPE_LABELS: Record<string, string> = {
  FREE: "무료",
  PAID: "유료",
};
const SUPPLY_TYPE_LABELS: Record<string, string> = {
  RECURRING: "지속발주 가능",
  SINGLE: "단타성 제품",
};

function formatKRW(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ProposalsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;
  const isMaster = userRole === "MASTER";

  // SELLER는 접근 불가 → 대시보드로 리다이렉트
  useEffect(() => {
    if (sessionStatus === "authenticated" && userRole === "SELLER") {
      router.replace("/dashboard");
    }
  }, [sessionStatus, userRole, router]);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);

  // Form state
  const emptyForm = {
    companyName: "",
    contact: "",
    phone: "",
    productName: "",
    category: "",
    subcategory: "",
    description: "",
    brand: "",
    productCode: "",
    sampleType: "" as string,
    samplePrice: 0,
    supplyType: "" as string,
    imageMain: "",
    imageSubs: "[]",
    onlineLowestPrice: "" as string | number,
    supplyPrice: "" as string | number,
    expiryDate: "",
    stockQty: "" as string | number,
  };
  const [formData, setFormData] = useState(emptyForm);

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const mainImageRef = useRef<HTMLInputElement>(null);
  const subImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proposals");
      const data = await res.json();
      if (res.ok && data.data) {
        setProposals(data.data);
      } else {
        setError(data.error?.message || "제안 목록을 불러올 수 없습니다");
      }
    } catch {
      setError("제안 목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // PROPOSAL-06: 이미지 업로드
  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.data?.url) {
        return data.data.url;
      }
      // 에러 메시지 표시
      const msg = data?.error?.message;
      if (msg) setError(`이미지 업로드 실패: ${msg}`);
      return null;
    } catch (err: any) {
      setError(`이미지 업로드 중 오류: ${err?.message || "알 수 없는 오류"}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const url = await uploadImage(file);
    if (url) setFormData((p) => ({ ...p, imageMain: url }));
    // 같은 파일 다시 선택 가능하게 input value 리셋
    if (mainImageRef.current) mainImageRef.current.value = "";
  };

  const handleSubImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setError(null);
    const current: string[] = JSON.parse(formData.imageSubs || "[]");
    if (current.length + files.length > 5) {
      alert("서브 이미지는 최대 5장까지 가능합니다.");
      return;
    }
    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) current.push(url);
    }
    setFormData((p) => ({ ...p, imageSubs: JSON.stringify(current) }));
    if (subImageRef.current) subImageRef.current.value = "";
  };

  const removeSubImage = (idx: number) => {
    const current: string[] = JSON.parse(formData.imageSubs || "[]");
    current.splice(idx, 1);
    setFormData((p) => ({ ...p, imageSubs: JSON.stringify(current) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload: any = { ...formData };
      // 빈 값 정리
      if (!payload.subcategory) delete payload.subcategory;
      if (!payload.brand) delete payload.brand;
      if (!payload.productCode) delete payload.productCode;
      if (!payload.sampleType) delete payload.sampleType;
      if (!payload.supplyType) delete payload.supplyType;
      if (!payload.imageMain) delete payload.imageMain;
      if (payload.imageSubs === "[]") delete payload.imageSubs;
      if (!payload.samplePrice || payload.samplePrice === 0) delete payload.samplePrice;
      // PROPOSAL-07: 신규 필드 정리 (빈 문자열 → 제거, 숫자 변환)
      if (payload.onlineLowestPrice === "" || payload.onlineLowestPrice === null) {
        delete payload.onlineLowestPrice;
      } else {
        payload.onlineLowestPrice = Number(payload.onlineLowestPrice);
      }
      if (payload.supplyPrice === "" || payload.supplyPrice === null) {
        delete payload.supplyPrice;
      } else {
        payload.supplyPrice = Number(payload.supplyPrice);
      }
      if (!payload.expiryDate) delete payload.expiryDate;
      if (payload.stockQty === "" || payload.stockQty === null) {
        delete payload.stockQty;
      } else {
        payload.stockQty = Number(payload.stockQty);
      }

      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setFormData(emptyForm);
        loadProposals();
      } else {
        setError(data.error?.message || "제안 등록에 실패했습니다");
      }
    } catch {
      setError("제안 등록 중 오류가 발생했습니다");
    }
  };

  // 카테고리별 그룹핑
  const filteredProposals = useMemo(() => {
    return activeCategory === "전체"
      ? proposals
      : proposals.filter((p) => p.category === activeCategory);
  }, [proposals, activeCategory]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, Proposal[]> = {};
    filteredProposals.forEach((p) => {
      const cat = p.category || "기타";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filteredProposals]);

  const subImages: string[] = JSON.parse(formData.imageSubs || "[]");
  const subcategories = CATEGORIES[formData.category] || [];

  // SELLER 리다이렉트 중이면 빈 화면
  if (sessionStatus === "authenticated" && userRole === "SELLER") {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">상품 제안</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              센터에서 발주 가능한 추천 상품을 확인하세요
            </p>
          </div>
        </div>
        {isMaster && (
          <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {showForm ? "취소" : "새 상품 등록"}
          </Button>
        )}
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              className="ml-auto text-red-500 hover:text-red-700"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* 등록 폼 — MASTER만 */}
      {isMaster && showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">새 상품 등록</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">기본 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>업체명 *</Label>
                  <Input value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} required />
                </div>
                <div>
                  <Label>담당자 *</Label>
                  <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
                </div>
                <div>
                  <Label>연락처 *</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                </div>
                <div>
                  <Label>상품코드</Label>
                  <Input value={formData.productCode} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} placeholder="[33] 등" />
                </div>
                <div>
                  <Label>상품명 *</Label>
                  <Input value={formData.productName} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} required />
                </div>
                <div>
                  <Label>브랜드</Label>
                  <Input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
                </div>
                <div>
                  <Label>카테고리 *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v || "", subcategory: "" })}>
                    <SelectTrigger><SelectValue placeholder="대분류 선택" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(CATEGORIES).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {subcategories.length > 0 && (
                  <div>
                    <Label>소분류</Label>
                    <Select value={formData.subcategory} onValueChange={(v) => setFormData({ ...formData, subcategory: v || "" })}>
                      <SelectTrigger><SelectValue placeholder="소분류 선택" /></SelectTrigger>
                      <SelectContent>
                        {subcategories.map((sub) => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Label>상품 설명 *</Label>
                  <TipTapEditor
                    value={formData.description}
                    onChange={(html) => setFormData({ ...formData, description: html })}
                    placeholder="상품의 특징, 구성, 효과 등을 자유롭게 작성하세요..."
                  />
                </div>
              </div>
            </div>

            {/* PROPOSAL-07: 가격/재고/유통기한 (모두 선택) */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">가격 · 재고 · 유통기한</h3>
              <p className="text-xs text-muted-foreground mb-3">모든 항목은 선택 입력. 비워두면 카드에서 &quot;—&quot;로 표시됩니다.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>온라인 최저가 (원)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="예: 12000"
                    value={formData.onlineLowestPrice}
                    onChange={(e) => setFormData({ ...formData, onlineLowestPrice: e.target.value })}
                    min={0}
                  />
                </div>
                <div>
                  <Label>공급가 (원)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="예: 8500"
                    value={formData.supplyPrice}
                    onChange={(e) => setFormData({ ...formData, supplyPrice: e.target.value })}
                    min={0}
                  />
                </div>
                <div>
                  <Label>유통기한</Label>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>재고 갯수</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="예: 200"
                    value={formData.stockQty}
                    onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* PROPOSAL-06: 이미지 업로드 */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">상품 이미지</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 메인 썸네일 */}
                <div>
                  <Label>메인 썸네일</Label>
                  <input ref={mainImageRef} type="file" accept="image/*" className="hidden" onChange={handleMainImage} />
                  {formData.imageMain ? (
                    <div className="relative mt-2 w-40 h-40 border rounded overflow-hidden group">
                      <img src={formData.imageMain} alt="메인" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                        onClick={() => setFormData({ ...formData, imageMain: "" })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-40 h-40 flex flex-col items-center justify-center gap-2 border-dashed"
                      onClick={() => mainImageRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageIcon className="h-6 w-6" />}
                      <span className="text-xs">이미지 업로드</span>
                    </Button>
                  )}
                </div>

                {/* 서브 이미지 */}
                <div>
                  <Label>서브 이미지 (최대 5장)</Label>
                  <input ref={subImageRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSubImages} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {subImages.map((url, i) => (
                      <div key={i} className="relative w-20 h-20 border rounded overflow-hidden group">
                        <img src={url} alt={`서브 ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                          onClick={() => removeSubImage(i)}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    {subImages.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-20 h-20 flex flex-col items-center justify-center border-dashed"
                        onClick={() => subImageRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PROPOSAL-06: 샘플/공급 정책 */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">샘플 및 발주 방식</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>샘플 유형</Label>
                  <Select value={formData.sampleType} onValueChange={(v) => setFormData({ ...formData, sampleType: v || "" })}>
                    <SelectTrigger>
                      {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                      <span className={formData.sampleType ? "" : "text-grey-500"}>
                        {formData.sampleType
                          ? (SAMPLE_TYPE_LABELS[formData.sampleType] ?? formData.sampleType)
                          : "선택"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE">무료</SelectItem>
                      <SelectItem value="PAID">유료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.sampleType === "PAID" && (
                  <div>
                    <Label>샘플 가격 (원)</Label>
                    <Input type="number" value={formData.samplePrice || ""} onChange={(e) => setFormData({ ...formData, samplePrice: parseInt(e.target.value) || 0 })} min={0} />
                  </div>
                )}
                <div>
                  <Label>발주 방식</Label>
                  <Select value={formData.supplyType} onValueChange={(v) => setFormData({ ...formData, supplyType: v || "" })}>
                    <SelectTrigger>
                      {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                      <span className={formData.supplyType ? "" : "text-grey-500"}>
                        {formData.supplyType
                          ? (SUPPLY_TYPE_LABELS[formData.supplyType] ?? formData.supplyType)
                          : "선택"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECURRING">지속발주 가능</SelectItem>
                      <SelectItem value="SINGLE">단타성 제품</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>취소</Button>
              <Button type="submit" disabled={uploading}>등록</Button>
            </div>
          </form>
        </Card>
      )}

      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {ALL_CATEGORIES.map((cat) => {
          const count = cat === "전체"
            ? proposals.length
            : proposals.filter((p) => p.category === cat).length;
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat} <span className={active ? "opacity-80" : "text-muted-foreground"}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* 카드 그리드 — 카테고리별 그룹 */}
      {filteredProposals.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <div className="text-muted-foreground">
            {activeCategory === "전체"
              ? "등록된 상품이 없습니다"
              : `"${activeCategory}" 카테고리에 등록된 상품이 없습니다`}
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByCategory).map(([category, items]) => (
            <section key={category}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {category}
                <span className="text-sm text-muted-foreground font-normal">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((p) => (
                  <ProductCard
                    key={p.id}
                    proposal={p}
                    onClick={() => setDetailProposal(p)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {detailProposal && (
        <DetailModal
          proposal={detailProposal}
          onClose={() => setDetailProposal(null)}
        />
      )}
    </div>
  );
}

// ──────────────── 카드 컴포넌트 ────────────────
function ProductCard({ proposal, onClick }: { proposal: Proposal; onClick: () => void }) {
  const supplyTypeBadge = proposal.supplyType === "RECURRING"
    ? { label: "지속발주", color: "bg-green-100 text-green-800", icon: <Repeat className="h-3 w-3" /> }
    : proposal.supplyType === "SINGLE"
    ? { label: "단타성", color: "bg-amber-100 text-amber-800", icon: <Zap className="h-3 w-3" /> }
    : null;

  const stockLow = typeof proposal.stockQty === "number" && proposal.stockQty <= 10;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white border rounded-lg overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all"
    >
      {/* 이미지 */}
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {proposal.imageMain ? (
          <img
            src={proposal.imageMain}
            alt={proposal.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageIcon className="h-12 w-12" />
          </div>
        )}
        {/* 배지 오버레이 */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {supplyTypeBadge && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${supplyTypeBadge.color}`}>
              {supplyTypeBadge.icon}
              {supplyTypeBadge.label}
            </span>
          )}
          {stockLow && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
              재고 부족
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="p-3 space-y-2">
        {/* 카테고리 */}
        <div className="text-xs text-muted-foreground">
          {proposal.category}
          {proposal.subcategory && ` › ${proposal.subcategory}`}
        </div>

        {/* 제품명 */}
        <div className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
          {proposal.productName}
        </div>

        {/* 가격 */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">온라인 최저가</span>
            <span className="line-through text-gray-400">{formatKRW(proposal.onlineLowestPrice)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">공급가</span>
            <span className="text-base font-bold text-blue-600">{formatKRW(proposal.supplyPrice)}</span>
          </div>
        </div>

        {/* 메타 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span>유통기한 {formatDate(proposal.expiryDate)}</span>
          <span>
            재고{" "}
            <span className={stockLow ? "text-red-600 font-medium" : "text-gray-700 font-medium"}>
              {typeof proposal.stockQty === "number" ? proposal.stockQty.toLocaleString() : "—"}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

// ──────────────── 상세 모달 ────────────────
function DetailModal({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  const subImages: string[] = useMemo(() => {
    try { return JSON.parse(proposal.imageSubs || "[]"); } catch { return []; }
  }, [proposal.imageSubs]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{proposal.productName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 이미지 */}
          {proposal.imageMain && (
            <img
              src={proposal.imageMain}
              alt={proposal.productName}
              className="w-full max-h-96 object-contain bg-gray-50 rounded"
            />
          )}
          {subImages.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {subImages.map((url, i) => (
                <img key={i} src={url} alt={`${proposal.productName} ${i + 1}`} className="aspect-square object-cover rounded border" />
              ))}
            </div>
          )}

          {/* 핵심 정보 */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
            <div><div className="text-muted-foreground text-xs">카테고리</div><div className="font-medium">{proposal.category}{proposal.subcategory && ` › ${proposal.subcategory}`}</div></div>
            <div><div className="text-muted-foreground text-xs">브랜드</div><div className="font-medium">{proposal.brand || "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">온라인 최저가</div><div className="font-medium line-through text-gray-500">{formatKRW(proposal.onlineLowestPrice)}</div></div>
            <div><div className="text-muted-foreground text-xs">공급가</div><div className="font-bold text-blue-600">{formatKRW(proposal.supplyPrice)}</div></div>
            <div><div className="text-muted-foreground text-xs">유통기한</div><div className="font-medium">{formatDate(proposal.expiryDate)}</div></div>
            <div><div className="text-muted-foreground text-xs">재고</div><div className="font-medium">{typeof proposal.stockQty === "number" ? proposal.stockQty.toLocaleString() : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">발주 방식</div><div className="font-medium">{proposal.supplyType === "RECURRING" ? "지속발주 가능" : proposal.supplyType === "SINGLE" ? "단타성 제품" : "—"}</div></div>
            <div><div className="text-muted-foreground text-xs">상품코드</div><div className="font-medium font-mono">{proposal.productCode || "—"}</div></div>
          </div>

          {/* 업체 정보 */}
          <div className="text-sm">
            <h4 className="font-semibold mb-2">공급업체</h4>
            <div className="text-muted-foreground">
              {proposal.companyName} | {proposal.contact} | {proposal.phone}
            </div>
          </div>

          {/* 설명 */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">상품 설명</h4>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(proposal.description) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
