"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, CheckCircle, XCircle, Clock } from "lucide-react";

type Proposal = {
  id: string;
  companyName: string;
  contact: string;
  phone: string;
  productName: string;
  category: string;
  description: string;
  status: string;
  submittedBy: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
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

export default function ProposalsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isMasterOrSubMaster = userRole === "MASTER" || userRole === "SUB_MASTER";

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    contact: "",
    phone: "",
    productName: "",
    category: "",
    description: "",
  });

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
    } catch (err) {
      console.error("Error loading proposals:", err);
      setError("제안 목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setShowForm(false);
        setFormData({
          companyName: "",
          contact: "",
          phone: "",
          productName: "",
          category: "",
          description: "",
        });
        loadProposals();
      } else {
        setError(data.error?.message || "제안 등록에 실패했습니다");
      }
    } catch (err) {
      console.error("Error submitting proposal:", err);
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

      const data = await res.json();

      if (res.ok) {
        loadProposals();
      } else {
        alert(data.error?.message || "상태 변경에 실패했습니다");
      }
    } catch (err) {
      console.error("Error changing proposal status:", err);
      alert("상태 변경 중 오류가 발생했습니다");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">상품 제안</h1>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "취소" : "새 제안"}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-600">{error}</div>
        </Card>
      )}

      {/* Submission Form */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">새 제안 등록</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업체명 *
                </label>
                <Input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  담당자 *
                </label>
                <Input
                  type="text"
                  value={formData.contact}
                  onChange={(e) =>
                    setFormData({ ...formData, contact: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 *
                </label>
                <Input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상품명 *
                </label>
                <Input
                  type="text"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리 *
                </label>
                <Input
                  type="text"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상품 설명 *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                취소
              </Button>
              <Button type="submit">제출</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Proposals List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">제안 목록</h2>
        {proposals.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            등록된 제안이 없습니다
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {proposal.productName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {proposal.companyName} | {proposal.contact} | {proposal.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md ${
                        statusColors[proposal.status]
                      }`}
                    >
                      {statusIcons[proposal.status]}
                      {statusLabels[proposal.status]}
                    </span>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">카테고리:</span> {proposal.category}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">{proposal.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
                  <span>
                    제출: {proposal.user.name} |{" "}
                    {new Date(proposal.createdAt).toLocaleString("ko-KR")}
                  </span>
                  {isMasterOrSubMaster && proposal.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(proposal.id, "APPROVED")}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(proposal.id, "REJECTED")}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        거절
                      </Button>
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
