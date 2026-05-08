"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenterForm } from "../components/CenterForm";

interface AdminResult {
  username: string;
  temporaryPassword: string;
  name: string;
}

export default function NewCenterPage() {
  const router = useRouter();
  const [adminResult, setAdminResult] = useState<AdminResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!adminResult) return;
    const text = `아이디: ${adminResult.username}\n임시 비밀번호: ${adminResult.temporaryPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 결과 다이얼로그
  if (adminResult) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card className="p-8">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h2 className="text-2xl font-bold">센터 및 관리자 계정 생성 완료</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <h3 className="font-semibold text-lg">관리자 계정 정보</h3>
              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                <span className="text-muted-foreground">아이디</span>
                <span className="font-mono font-semibold">{adminResult.username}</span>
                <span className="text-muted-foreground">임시 비밀번호</span>
                <span className="font-mono font-semibold">{adminResult.temporaryPassword}</span>
                <span className="text-muted-foreground">이름</span>
                <span>{adminResult.name}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <span className="shrink-0 mt-0.5">&#9888;</span>
              <span>임시 비밀번호는 이 화면에서만 확인 가능합니다. 반드시 복사하여 전달해 주세요. 첫 로그인 시 비밀번호 변경이 필요합니다.</span>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    계정 정보 복사
                  </>
                )}
              </Button>
              <Button onClick={() => router.push("/admin/centers")}>
                확인
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">새 센터 등록</h1>
      </div>

      <Card className="p-6">
        <CenterForm
          onSuccess={(admin) => {
            if (admin) {
              setAdminResult(admin);
            } else {
              alert("센터가 성공적으로 생성되었습니다!");
              router.push("/admin/centers");
            }
          }}
          onCancel={() => router.back()}
        />
      </Card>
    </div>
  );
}
