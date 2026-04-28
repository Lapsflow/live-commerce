"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
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
  ClipboardList, Search, CheckCircle, XCircle, Clock,
  Package, TrendingUp, AlertCircle,
} from "lucide-react";

interface SampleRequest {
  id: string;
  companyName: string;
  contact: string;
  phone: string;
  productName: string;
  description: string;
  status: string;
  sampleType?: string;
  samplePrice?: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    centerId?: string;
    center?: { id: string; name: string };
  };
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  thisMonth: number;
}

const statusLabels: Record<string, string> = {
  PENDING: "대기중",
  APPROVED: "승인",
  REJECTED: "거절",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function SampleRequestsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;

  const [requests, setRequests] = useState<SampleRequest[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/proposals/samples?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setRequests(data.data.proposals);
        setStats(data.data.stats);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(loadRequests, 300);
    return () => clearTimeout(timeout);
  }, [statusFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingIds = requests.filter((r) => r.status === "PENDING").map((r) => r.id);
    if (selectedIds.size === pendingIds.length && pendingIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const handleBatchAction = async (status: "APPROVED" | "REJECTED") => {
    if (selectedIds.size === 0) return;
    setBatchProcessing(true);
    try {
      const res = await fetch("/api/proposals/samples", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        loadRequests();
      }
    } catch {
      // ignore
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleSingleAction = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/proposals/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) loadRequests();
    } catch {
      // ignore
    }
  };

  // Extract quantity from description
  const parseQuantity = (desc: string) => {
    const match = desc.match(/수량:\s*(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const parsePrice = (desc: string) => {
    const match = desc.match(/가격:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  if (userRole && userRole !== "MASTER" && userRole !== "SUB_MASTER") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">MASTER 또는 SUB_MASTER만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">샘플 요청 관리</h1>
          <p className="text-sm text-muted-foreground">셀러들의 샘플 요청을 확인하고 승인/거절합니다</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-muted-foreground">전체</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">대기중</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">승인</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">거절</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">이번달</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.thisMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Batch Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="상품명, 업체명, 요청자명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : (v || ""))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="PENDING">대기중</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="REJECTED">거절</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleBatchAction("APPROVED")}
              disabled={batchProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {selectedIds.size}건 승인
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBatchAction("REJECTED")}
              disabled={batchProcessing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {selectedIds.size}건 거절
            </Button>
          </div>
        )}
      </div>

      {/* Request List */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">샘플 요청이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === requests.filter((r) => r.status === "PENDING").length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">상품명</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">요청자</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">센터</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">수량</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">가격</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">상태</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">요청일</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requests.map((req) => {
                    const qty = parseQuantity(req.description);
                    const price = parsePrice(req.description);
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          {req.status === "PENDING" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(req.id)}
                              onChange={() => toggleSelect(req.id)}
                              className="rounded"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium max-w-[200px] truncate">{req.productName}</div>
                          <div className="text-xs text-muted-foreground">{req.companyName}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div>{req.user.name}</div>
                          <div className="text-xs text-muted-foreground">{req.phone}</div>
                        </td>
                        <td className="px-3 py-3">
                          {req.user.center?.name || "-"}
                        </td>
                        <td className="px-3 py-3 text-center">{qty}개</td>
                        <td className="px-3 py-3 text-right">
                          {price === 0 ? (
                            <Badge className="bg-green-100 text-green-700">무료</Badge>
                          ) : (
                            <span>{price.toLocaleString()}원</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge className={statusColors[req.status]}>
                            {statusLabels[req.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {req.status === "PENDING" && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 px-2"
                                onClick={() => handleSingleAction(req.id, "APPROVED")}
                              >
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                onClick={() => handleSingleAction(req.id, "REJECTED")}
                              >
                                거절
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
