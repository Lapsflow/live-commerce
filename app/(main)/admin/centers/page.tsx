"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { centerColumns } from "./components/center-columns";
import type { CenterWithStats } from "@/lib/services/center/centerService";

export default function CentersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [centers, setCenters] = useState<CenterWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 권한 확인 (MASTER, SUB_MASTER, ADMIN만 접근 가능)
  const userRole = (session?.user as any)?.role;
  const hasAccess = ["MASTER", "SUB_MASTER", "ADMIN"].includes(userRole);
  const canCreate = userRole === "MASTER"; // MASTER만 센터 생성 가능

  useEffect(() => {
    if (hasAccess) {
      loadCenters();
    }
  }, [hasAccess]);

  const loadCenters = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/centers");
      const data = await res.json();

      if (res.ok && data.success) {
        setCenters(data.data);
      } else {
        setError(data.error?.message || "센터 목록을 불러올 수 없습니다");
      }
    } catch (err) {
      console.error("Error loading centers:", err);
      setError("센터 목록을 불러오는 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 권한 없음
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <div className="text-red-600">
            이 페이지에 접근할 권한이 없습니다. (MASTER, SUB_MASTER, ADMIN만 접근 가능)
          </div>
        </Card>
      </div>
    );
  }

  // 에러 표시
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-red-600">{error}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">센터 관리</h1>
      </div>

      {/* Centers DataTable */}
      <DataTable
        columns={centerColumns}
        dataSource={{ mode: "client", fetchAll: () => centers }}
        title="센터 목록"
        searchPlaceholder="센터명 또는 센터코드로 검색..."
        filterableColumns={[
          {
            id: "regionCode",
            title: "지역",
            options: [
              { label: "서울", value: "01" },
              { label: "경기", value: "02" },
              { label: "인천", value: "03" },
              { label: "강원", value: "04" },
              { label: "충북", value: "05" },
              { label: "충남", value: "06" },
              { label: "대전", value: "07" },
              { label: "세종", value: "08" },
              { label: "전북", value: "09" },
              { label: "전남", value: "10" },
              { label: "광주", value: "11" },
              { label: "경북", value: "12" },
              { label: "경남", value: "13" },
              { label: "대구", value: "14" },
              { label: "울산", value: "15" },
              { label: "부산", value: "16" },
              { label: "제주", value: "17" },
            ],
          },
          {
            id: "isActive",
            title: "상태",
            options: [
              { label: "활성", value: "true" },
              { label: "비활성", value: "false" },
            ],
          },
        ]}
        enableExport
        exportFileName="센터목록"
        onRowClick={(center) => router.push(`/admin/centers/${center.id}`)}
        onCreateClick={canCreate ? () => router.push("/admin/centers/new") : undefined}
        createLabel={canCreate ? "센터 추가" : undefined}
        defaultPageSize={20}
      />
    </div>
  );
}
