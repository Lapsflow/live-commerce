"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Lock, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const errorMessages: Record<string, string> = {
    INVALID_CREDENTIALS: "아이디 또는 비밀번호가 올바르지 않습니다",
    CONTRACT_PENDING: "계약 승인 대기 중입니다. 관리자 승인 후 로그인 가능합니다",
    CONTRACT_REJECTED: "계약이 거절되었습니다. 관리자에게 문의하세요",
    CredentialsSignin: "아이디 또는 비밀번호가 올바르지 않습니다",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      const errorMessage = errorMessages[result.error] || "로그인에 실패했습니다";
      setError(errorMessage);
      setLoading(false);
    } else {
      setLoading(false);
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-50">
      <Card className="w-full max-w-md p-8 shadow-md">
        {/* 브랜딩 */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-white text-xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-bold text-grey-900">슈퍼무진</h1>
          <h2 className="text-sm font-medium text-grey-500 mt-0.5">라이브커머스 운영관리</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">아이디</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey-400" />
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-grey-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="pl-10"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red bg-red/5 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-grey-200 text-center">
          <p className="text-xs text-grey-400 mb-2">아직 계정이 없으신가요?</p>
          <a href="/signup" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
            회원가입
          </a>
        </div>
      </Card>
    </div>
  );
}
