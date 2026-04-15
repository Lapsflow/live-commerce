"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormData = {
  id: string;
  password: string;
  name: string;
  phone: string;
  email: string;
  role: "SELLER" | "ADMIN";
  adminId: string;
  centerId: string; // Phase 1: Required center selection
  channels: string[]; // Phase 1: Activity channels for SELLER
  avgSales: number | undefined; // Phase 1: Monthly average sales for SELLER
};

export default function SignupPage() {
  const [formData, setFormData] = useState<FormData>({
    id: "",
    password: "",
    name: "",
    phone: "",
    email: "",
    role: "SELLER",
    adminId: "",
    centerId: "",
    channels: [],
    avgSales: undefined,
  });
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);
  const [centers, setCenters] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false); // Phase 1: Show success message
  const [successMessage, setSuccessMessage] = useState<string>("");
  const router = useRouter();

  // Phase 1: Fetch centers on mount
  useEffect(() => {
    fetch("/api/centers")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCenters(data.data);
        }
      })
      .catch(() => setCenters([]));
  }, []);

  // 관리자 목록 조회 (셀러 선택 시)
  useEffect(() => {
    if (formData.role === "SELLER") {
      fetch("/api/users?role=ADMIN")
        .then((res) => res.json())
        .then((data) => setAdmins(data.data || []))
        .catch(() => setAdmins([]));
    }
  }, [formData.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Phase 1: Validate center selection
    if (!formData.centerId) {
      setError("센터를 선택해주세요.");
      setLoading(false);
      return;
    }

    // Phase 1: Validate SELLER-specific fields
    if (formData.role === "SELLER") {
      if (formData.channels.length === 0) {
        setError("활동 채널을 최소 1개 이상 선택해주세요.");
        setLoading(false);
        return;
      }
      if (!formData.avgSales || formData.avgSales <= 0) {
        setError("월평균 매출을 입력해주세요.");
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message || "회원가입 실패");
      setLoading(false);
    } else {
      setLoading(false);
      if (formData.role === "SELLER") {
        // Phase 1: Show approval waiting message for SELLER
        setSuccess(true);
        setSuccessMessage(data.data?.message || "회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.");
      } else {
        router.push("/login?signup=success");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">회원가입</h1>

        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              회원가입 완료
            </h2>
            <p className="text-gray-600">{successMessage}</p>
            <Button
              onClick={() => router.push("/login")}
              className="w-full mt-4"
            >
              로그인 페이지로 이동
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">아이디</label>
            <Input
              type="text"
              value={formData.id}
              onChange={(e) =>
                setFormData({ ...formData, id: e.target.value })
              }
              placeholder="아이디를 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">비밀번호</label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">이름</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="이름을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">연락처</label>
            <Input
              type="text"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="연락처를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">이메일</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="이메일을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">역할</label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as "SELLER" | "ADMIN" })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="역할을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SELLER">셀러</SelectItem>
                <SelectItem value="ADMIN">관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              소속 센터 <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.centerId}
              onValueChange={(value) =>
                setFormData({ ...formData, centerId: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="센터를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {centers.map((center) => (
                  <SelectItem key={center.id} value={center.id}>
                    {center.code} - {center.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.role === "SELLER" && admins.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                소속 관리자
              </label>
              <Select
                value={formData.adminId}
                onValueChange={(value) =>
                  setFormData({ ...formData, adminId: value || "" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="관리자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Phase 2: SELLER-specific fields */}
          {formData.role === "SELLER" && (
            <>
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">
                  판매자 추가 정보
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  활동 채널 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["쿠팡", "네이버", "SSG", "11번가", "GRIP", "CLME", "유튜브", "틱톡"].map(
                    (channel) => (
                      <label
                        key={channel}
                        className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.channels.includes(channel)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                channels: [...formData.channels, channel],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                channels: formData.channels.filter(
                                  (c) => c !== channel
                                ),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{channel}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  월평균 매출 (만원) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.avgSales || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      avgSales: parseInt(e.target.value) || undefined,
                    })
                  }
                  placeholder="예: 500 (500만원)"
                  min="0"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  최근 3개월 평균 매출을 입력해주세요
                </p>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </Button>
        </form>
        )}

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            이미 계정이 있으신가요? 로그인
          </a>
        </div>
      </Card>
    </div>
  );
}
