"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CenterForm } from "../../components/CenterForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditCenterPage() {
  const params = useParams();
  const router = useRouter();
  const centerId = params.id as string;

  const [center, setCenter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCenter();
  }, [centerId]);

  const loadCenter = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/centers/${centerId}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setCenter(data.data);
      } else {
        setError(data.error?.message || "센터 정보를 불러올 수 없습니다");
      }
    } catch (err) {
      console.error("Error loading center:", err);
      setError("센터 정보를 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Skeleton className="h-12 w-64 mb-6" />
        <Card className="p-6">
          <Skeleton className="h-96 w-full" />
        </Card>
      </div>
    );
  }

  if (error || !center) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-red-600">
            {error || "센터를 찾을 수 없습니다"}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">{center.name} 수정</h1>
      </div>

      <Card className="p-6">
        <CenterForm
          initialData={center}
          onSuccess={() => {
            alert("센터 정보가 성공적으로 수정되었습니다!");
            router.push(`/admin/centers/${centerId}`);
          }}
          onCancel={() => router.back()}
        />
      </Card>
    </div>
  );
}
