"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Users,
  Package,
  Radio,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

interface Center {
  id: string;
  code: string;
  name: string;
  regionCode: string;
  regionName: string;
  representative: string;
  representativePhone: string;
  address: string;
  addressDetail?: string | null;
  businessNo?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    users: number;
    centerStocks: number;
    orders: number;
    broadcasts: number;
  };
}

export default function CentersPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isMaster = userRole === "MASTER";

  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);

  // Create form state — PROPOSAL-07: 아이디/비밀번호 필수 통합
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    regionCode: "",
    regionName: "",
    representative: "",
    representativePhone: "",
    address: "",
    addressDetail: "",
    businessNo: "",
    adminUsername: "",
    adminPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // 생성 결과 (계정 정보 표시용)
  const [createdAccount, setCreatedAccount] = useState<{ username: string; temporaryPassword: string; name: string } | null>(null);

  useEffect(() => {
    loadCenters();
  }, [showActiveOnly]);

  const loadCenters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeStats: "true" });
      if (showActiveOnly) params.set("isActive", "true");
      const res = await fetch(`/api/centers?${params}`);
      const data = await res.json();
      if (res.ok && data.data?.centers) {
        setCenters(data.data.centers);
      }
    } catch {
      toast.error("센터 목록 로딩 실패");
    } finally {
      setLoading(false);
    }
  };

  // 혼동 문자(l,1,o,0,i) 제외 임시 비밀번호 생성
  const generateTempPassword = (length = 12): string => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => chars[b % chars.length]).join("");
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name || !formData.regionCode || !formData.regionName || !formData.representative || !formData.representativePhone || !formData.address) {
      toast.error("필수 항목을 모두 입력해주세요");
      return;
    }
    if (!formData.adminUsername || formData.adminUsername.length < 3) {
      toast.error("로그인 아이디는 3자 이상이어야 합니다");
      return;
    }
    if (!formData.adminPassword || formData.adminPassword.length < 8) {
      toast.error("로그인 비밀번호는 8자 이상이어야 합니다");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("센터 및 로그인 계정이 생성되었습니다");
        setShowCreateForm(false);
        // 결과 박스에 계정 정보 표시 (임시 비밀번호는 이 화면에서만 확인 가능)
        if (data.data?.admin) {
          setCreatedAccount(data.data.admin);
        }
        setFormData({
          code: "", name: "", regionCode: "", regionName: "",
          representative: "", representativePhone: "", address: "",
          addressDetail: "", businessNo: "",
          adminUsername: "", adminPassword: "",
        });
        loadCenters();
      } else {
        toast.error(data.error?.message || "센터 생성 실패");
      }
    } catch {
      toast.error("서버 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAccount = async () => {
    if (!createdAccount) return;
    const text = `아이디: ${createdAccount.username}\n비밀번호: ${createdAccount.temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("계정 정보가 복사되었습니다");
    } catch {
      toast.error("복사 실패");
    }
  };

  const handleToggleActive = async (center: Center) => {
    const action = center.isActive ? "비활성화" : "활성화";
    if (!confirm(`${center.name} 센터를 ${action}하시겠습니까?\n\n${center.isActive ? "비활성화해도 소속 사용자 계정은 유지됩니다." : ""}`)) {
      return;
    }
    const newActive = !center.isActive;
    try {
      const res = await fetch(`/api/centers/${center.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (res.ok) {
        toast.success(`센터가 ${action}되었습니다`);
        // 비활성화 시 "전체" 보기로 전환하여 센터가 목록에서 사라지지 않도록 함
        if (!newActive && showActiveOnly) {
          setShowActiveOnly(false); // useEffect가 loadCenters() 호출
        } else {
          loadCenters();
        }
      } else {
        toast.error("상태 변경 실패");
      }
    } catch {
      toast.error("서버 오류");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCenter) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/centers/${editingCenter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCenter.name,
          representative: editingCenter.representative,
          representativePhone: editingCenter.representativePhone,
          address: editingCenter.address,
          addressDetail: editingCenter.addressDetail,
          businessNo: editingCenter.businessNo,
        }),
      });
      if (res.ok) {
        toast.success("센터 정보가 수정되었습니다");
        setEditingCenter(null);
        loadCenters();
      } else {
        toast.error("수정 실패");
      }
    } catch {
      toast.error("서버 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = centers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.regionName.includes(q) ||
      c.representative.includes(q)
    );
  });

  const regionCodes: Record<string, string> = {
    "01": "서울", "02": "경기", "03": "인천", "04": "강원",
    "05": "충북", "06": "충남", "07": "대전", "08": "세종",
    "09": "전북", "10": "전남", "11": "광주", "12": "경북",
    "13": "경남", "14": "대구", "15": "울산", "16": "부산", "17": "제주",
  };

  if (!isMaster) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-red-600">MASTER 권한만 접근 가능합니다.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-grey-900">센터 관리</h1>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          센터 추가
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="p-6 border-blue-200 bg-blue-50/30">
          <h3 className="font-semibold text-lg mb-4">새 센터 등록</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-grey-700">센터 코드 *</label>
              <Input
                placeholder="예: 01-4213"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
              <p className="text-xs text-grey-500 mt-1">형식: [지역코드]-[4자리 숫자]</p>
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">센터명 *</label>
              <Input
                placeholder="센터명"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">지역코드 *</label>
              <select
                className="w-full px-3 py-2 border border-grey-300 rounded-md"
                value={formData.regionCode}
                onChange={(e) => setFormData({ ...formData, regionCode: e.target.value, regionName: regionCodes[e.target.value] || "" })}
              >
                <option value="">선택</option>
                {Object.entries(regionCodes).map(([code, name]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">대표자 *</label>
              <Input
                placeholder="대표자 이름"
                value={formData.representative}
                onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">대표자 연락처 *</label>
              <Input
                placeholder="010-0000-0000"
                value={formData.representativePhone}
                onChange={(e) => setFormData({ ...formData, representativePhone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">사업자등록번호</label>
              <Input
                placeholder="000-00-00000"
                value={formData.businessNo}
                onChange={(e) => setFormData({ ...formData, businessNo: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-grey-700">주소 *</label>
              <Input
                placeholder="주소"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">상세주소</label>
              <Input
                placeholder="상세주소"
                value={formData.addressDetail}
                onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
              />
            </div>
          </div>

          {/* 센터 로그인 계정 — PROPOSAL-07: 필수 통합 */}
          <div className="mt-6 pt-6 border-t border-blue-200">
            <h4 className="font-semibold text-base mb-1">센터 로그인 계정</h4>
            <p className="text-xs text-grey-600 mb-3">
              이 센터에서 사용할 로그인 아이디와 비밀번호를 입력하세요. 첫 로그인 시 비밀번호 변경이 필요합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-grey-700">아이디 *</label>
                <Input
                  placeholder="3자 이상 (예: gangnam01)"
                  value={formData.adminUsername}
                  onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-grey-700">비밀번호 *</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="8자 이상"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    className="font-mono flex-1"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, adminPassword: generateTempPassword() })}
                  >
                    자동 생성
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "생성 중..." : "센터 생성"}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>취소</Button>
          </div>
        </Card>
      )}

      {/* 생성 결과 — 임시 비밀번호 노출 */}
      {createdAccount && (
        <Card className="p-6 border-green-300 bg-green-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2 text-green-900">센터 및 로그인 계정 생성 완료</h3>
              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <span className="text-grey-600">아이디</span>
                <span className="font-mono font-semibold">{createdAccount.username}</span>
                <span className="text-grey-600">비밀번호</span>
                <span className="font-mono font-semibold">{createdAccount.temporaryPassword}</span>
                <span className="text-grey-600">담당자</span>
                <span>{createdAccount.name}</span>
              </div>
              <p className="text-xs text-amber-700 mt-3">
                ⚠️ 비밀번호는 이 화면에서만 확인 가능합니다. 반드시 복사하여 전달해 주세요.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={handleCopyAccount}>
                계정 정보 복사
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatedAccount(null)}>
                닫기
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search + Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-5 w-5 text-grey-400" />
            <Input
              placeholder="센터 코드, 이름, 지역, 대표자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={showActiveOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowActiveOnly(true)}
            >
              활성
            </Button>
            <Button
              variant={!showActiveOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowActiveOnly(false)}
            >
              전체
            </Button>
          </div>
        </div>
      </Card>

      {/* Edit Form */}
      {editingCenter && (
        <Card className="p-6 border-yellow-200 bg-yellow-50/30">
          <h3 className="font-semibold text-lg mb-4">센터 수정: {editingCenter.code}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-grey-700">센터명</label>
              <Input value={editingCenter.name} onChange={(e) => setEditingCenter({ ...editingCenter, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">대표자</label>
              <Input value={editingCenter.representative} onChange={(e) => setEditingCenter({ ...editingCenter, representative: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">연락처</label>
              <Input value={editingCenter.representativePhone} onChange={(e) => setEditingCenter({ ...editingCenter, representativePhone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-grey-700">주소</label>
              <Input value={editingCenter.address} onChange={(e) => setEditingCenter({ ...editingCenter, address: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-grey-700">사업자등록번호</label>
              <Input value={editingCenter.businessNo || ""} onChange={(e) => setEditingCenter({ ...editingCenter, businessNo: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSaveEdit} disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
            <Button variant="outline" onClick={() => setEditingCenter(null)}>취소</Button>
          </div>
        </Card>
      )}

      {/* Centers Table */}
      {loading ? (
        <div className="text-center py-12 text-grey-500">로딩 중...</div>
      ) : (
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-grey-200">
              <thead>
                <tr className="bg-grey-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">코드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">센터명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">지역</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">대표자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase">연락처</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-grey-500 uppercase">사용자</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-grey-500 uppercase">상품</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-grey-500 uppercase">발주</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-grey-500 uppercase">방송</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-grey-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-grey-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-grey-500">
                      {searchQuery ? "검색 결과가 없습니다" : "등록된 센터가 없습니다"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((center) => (
                    <tr key={center.id} className="hover:bg-grey-50">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-blue-600">{center.code}</td>
                      <td className="px-4 py-3 text-sm font-medium text-grey-900">{center.name}</td>
                      <td className="px-4 py-3 text-sm text-grey-600">{center.regionName}</td>
                      <td className="px-4 py-3 text-sm text-grey-600">{center.representative}</td>
                      <td className="px-4 py-3 text-sm text-grey-600">{center.representativePhone}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3" />{center._count?.users ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Package className="h-3 w-3" />{center._count?.centerStocks ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <ShoppingCart className="h-3 w-3" />{center._count?.orders ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Radio className="h-3 w-3" />{center._count?.broadcasts ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={center.isActive
                            ? "bg-green-50 text-green-700 border-green-300"
                            : "bg-grey-50 text-grey-500 border-grey-300"}
                        >
                          {center.isActive ? "활성" : "비활성"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingCenter(center)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={center.isActive ? "text-red-600" : "text-green-600"}
                            onClick={() => handleToggleActive(center)}
                          >
                            {center.isActive ? "비활성화" : "활성화"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="mt-4 pt-4 border-t border-grey-200">
              <p className="text-sm text-grey-600">
                총 <span className="font-semibold">{filtered.length}</span>개 센터
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
