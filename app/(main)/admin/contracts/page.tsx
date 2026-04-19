"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PendingContract = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  channels: string[];
  avgSales: number | null;
  contractStatus: string;
  centerId: string | null;
  center?: {
    code: string;
    name: string;
  };
  createdAt: string;
};

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<PendingContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingContracts();
  }, []);

  const fetchPendingContracts = async () => {
    try {
      const res = await fetch("/api/users?role=SELLER&contractStatus=PENDING");
      const data = await res.json();
      if (data.data) {
        setContracts(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch pending contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    if (!confirm("이 계약을 승인하시겠습니까?")) return;

    setProcessingId(userId);
    try {
      const res = await fetch(`/api/admin/contracts/${userId}/approve`, {
        method: "POST",
      });

      if (res.ok) {
        alert("계약이 승인되었습니다.");
        fetchPendingContracts();
      } else {
        const data = await res.json();
        alert(data.error?.message || "승인 실패");
      }
    } catch (error) {
      alert("승인 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    const reason = rejectionReason[userId];
    if (!reason || reason.trim() === "") {
      alert("거부 사유를 입력해주세요.");
      return;
    }

    if (!confirm("이 계약을 거부하시겠습니까?")) return;

    setProcessingId(userId);
    try {
      const res = await fetch(`/api/admin/contracts/${userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert("계약이 거부되었습니다.");
        fetchPendingContracts();
        setRejectionReason({ ...rejectionReason, [userId]: "" });
      } else {
        const data = await res.json();
        alert(data.error?.message || "거부 실패");
      }
    } catch (error) {
      alert("거부 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <Card className="p-8">
          <div className="text-center">로딩 중...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">판매자 계약 승인</h1>
        <p className="text-grey-600 mt-2">
          대기 중인 판매자 계약을 승인 또는 거부할 수 있습니다.
        </p>
      </div>

      {contracts.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-grey-500">
            대기 중인 계약이 없습니다.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <Card key={contract.id} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: User Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold">{contract.name}</h3>
                    <p className="text-sm text-grey-500">
                      {contract.email} | {contract.phone || "연락처 없음"}
                    </p>
                  </div>

                  {contract.center && (
                    <div className="bg-grey-50 p-3 rounded">
                      <p className="text-sm font-medium text-grey-700">
                        소속 센터
                      </p>
                      <p className="text-sm text-grey-900">
                        {contract.center.code} - {contract.center.name}
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm font-medium text-grey-700">활동 채널</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contract.channels.map((channel) => (
                        <span
                          key={channel}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-sm font-medium text-grey-700">
                      월평균 매출
                    </p>
                    <p className="text-lg font-semibold text-green-700">
                      {contract.avgSales?.toLocaleString()}만원
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-grey-500">
                      신청일: {new Date(contract.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      거부 사유 (선택)
                    </label>
                    <Input
                      type="text"
                      value={rejectionReason[contract.id] || ""}
                      onChange={(e) =>
                        setRejectionReason({
                          ...rejectionReason,
                          [contract.id]: e.target.value,
                        })
                      }
                      placeholder="예: 서류 미비, 자격 미달 등"
                      disabled={processingId === contract.id}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleReject(contract.id)}
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                      disabled={processingId === contract.id}
                    >
                      {processingId === contract.id ? "처리 중..." : "거부"}
                    </Button>
                    <Button
                      onClick={() => handleApprove(contract.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={processingId === contract.id}
                    >
                      {processingId === contract.id ? "처리 중..." : "승인"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
