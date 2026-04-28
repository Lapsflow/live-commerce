"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText, Plus, CheckCircle, XCircle, Clock,
  Upload, ImageIcon, X, Loader2,
} from "lucide-react";

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
  submittedBy: string;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
};

const statusLabels: Record<string, string> = {
  PENDING: "검토중",
  APPROVED: "승인",
  REJECTED: "거절",
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4" />,
  APPROVED: <CheckCircle className="h-4 w-4" />,
  REJECTED: <XCircle className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
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

export default function ProposalsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isMasterOrSubMaster = userRole === "MASTER" || userRole === "SUB_MASTER";

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
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
  });

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
      return null;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setFormData((p) => ({ ...p, imageMain: url }));
  };

  const handleSubImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
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
      if (!payload.subcategory) delete payload.subcategory;
      if (!payload.brand) delete payload.brand;
      if (!payload.productCode) delete payload.productCode;
      if (!payload.sampleType) delete payload.sampleType;
      if (!payload.supplyType) delete payload.supplyType;
      if (!payload.imageMain) delete payload.imageMain;
      if (payload.imageSubs === "[]") delete payload.imageSubs;
      if (payload.samplePrice === 0) delete payload.samplePrice;

      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setFormData({
          companyName: "", contact: "", phone: "", productName: "",
          category: "", subcategory: "", description: "", brand: "",
          productCode: "", sampleType: "", samplePrice: 0,
          supplyType: "", imageMain: "", imageSubs: "[]",
        });
        loadProposals();
      } else {
        setError(data.error?.message || "제안 등록에 실패했습니다");
      }
    } catch {
      setError("제안 등록 중 오류가 발생했습니다");
    }
  };

  const handleStatusChange = async (proposalId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadProposals();
      } else {
        const data = await res.json();
        alert(data.error?.message || "상태 변경에 실패했습니다");
      }
    } catch {
      alert("상태 변경 중 오류가 발생했습니다");
    }
  };

  const subImages: string[] = JSON.parse(formData.imageSubs || "[]");
  const subcategories = CATEGORIES[formData.category] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">상품 제안</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? "취소" : "새 제안"}
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-600">{error}</div>
        </Card>
      )}

      {/* 등록 폼 */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">새 제안 등록</h2>
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
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} required />
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
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">샘플 및 공급 정책</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>샘플 유형</Label>
                  <Select value={formData.sampleType} onValueChange={(v) => setFormData({ ...formData, sampleType: v || "" })}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
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
                  <Label>공급 방식</Label>
                  <Select value={formData.supplyType} onValueChange={(v) => setFormData({ ...formData, supplyType: v || "" })}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE">단발</SelectItem>
                      <SelectItem value="RECURRING">정기</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>취소</Button>
              <Button type="submit" disabled={uploading}>제출</Button>
            </div>
          </form>
        </Card>
      )}

      {/* 제안 목록 */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">제안 목록</h2>
        {proposals.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">등록된 제안이 없습니다</div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-3">
                    {proposal.imageMain && (
                      <img src={proposal.imageMain} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">{proposal.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {proposal.companyName} | {proposal.contact} | {proposal.phone}
                      </p>
                      {proposal.brand && (
                        <Badge variant="outline" className="mt-1 text-xs">{proposal.brand}</Badge>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md ${statusColors[proposal.status]}`}>
                    {statusIcons[proposal.status]}
                    {statusLabels[proposal.status]}
                  </span>
                </div>
                <div className="mb-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">카테고리:</span> {proposal.category}
                    {proposal.subcategory && ` > ${proposal.subcategory}`}
                  </p>
                  {proposal.sampleType && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">샘플:</span>{" "}
                      {proposal.sampleType === "FREE" ? "무료" : `유료 (${proposal.samplePrice?.toLocaleString()}원)`}
                    </p>
                  )}
                  <p className="text-sm mt-2">{proposal.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                  <span>
                    제출: {proposal.user.name} |{" "}
                    {new Date(proposal.createdAt).toLocaleString("ko-KR")}
                  </span>
                  {isMasterOrSubMaster && proposal.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(proposal.id, "APPROVED")} className="text-green-600 border-green-600 hover:bg-green-50">승인</Button>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(proposal.id, "REJECTED")} className="text-red-600 border-red-600 hover:bg-red-50">거절</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
