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
  });
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message || "회원가입 실패");
      setLoading(false);
    } else {
      router.push("/login?signup=success");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">회원가입</h1>

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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            이미 계정이 있으신가요? 로그인
          </a>
        </div>
      </Card>
    </div>
  );
}
