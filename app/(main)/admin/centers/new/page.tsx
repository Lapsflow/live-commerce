"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenterForm } from "../components/CenterForm";

export default function NewCenterPage() {
  const router = useRouter();

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
          onSuccess={() => {
            alert("센터가 성공적으로 생성되었습니다!");
            router.push("/admin/centers");
          }}
          onCancel={() => router.back()}
        />
      </Card>
    </div>
  );
}
