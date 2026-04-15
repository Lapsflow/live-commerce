"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Users,
  Package,
  BarChart3,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CenterWithStats } from "@/lib/services/center/centerService";

export default function CenterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const centerId = params.id as string;

  const [center, setCenter] = useState<CenterWithStats | null>(null);
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
      <div className="container mx-auto py-6 max-w-6xl">
        <Skeleton className="h-12 w-64 mb-6" />
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (error || !center) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-6">
          <div className="text-red-600">{error || "센터를 찾을 수 없습니다"}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{center.name}</h1>
            <p className="text-muted-foreground font-mono">{center.code}</p>
          </div>
          <Badge variant={center.isActive ? "default" : "secondary"}>
            {center.isActive ? "활성" : "비활성"}
          </Badge>
        </div>
        <Button onClick={() => router.push(`/admin/centers/${centerId}/edit`)}>
          <Edit className="mr-2 h-4 w-4" />
          수정
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            사용자 ({center._count?.users || 0})
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="mr-2 h-4 w-4" />
            상품 ({center._count?.centerStocks || 0})
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-2 h-4 w-4" />
            통계
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">센터 정보</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">센터코드</dt>
                  <dd className="font-mono font-semibold">{center.code}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">센터명</dt>
                  <dd className="font-semibold">{center.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">지역</dt>
                  <dd>
                    {center.regionName} ({center.regionCode})
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">상태</dt>
                  <dd>
                    <Badge variant={center.isActive ? "default" : "secondary"}>
                      {center.isActive ? "활성" : "비활성"}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">대표자 정보</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">대표자</dt>
                  <dd className="font-semibold">{center.representative}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">연락처</dt>
                  <dd>{center.representativePhone}</dd>
                </div>
                {center.businessNo && (
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      사업자등록번호
                    </dt>
                    <dd className="font-mono">{center.businessNo}</dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card className="p-6 md:col-span-2">
              <h3 className="text-lg font-semibold mb-4">주소</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">주소</dt>
                  <dd>{center.address}</dd>
                </div>
                {center.addressDetail && (
                  <div>
                    <dt className="text-sm text-muted-foreground">상세주소</dt>
                    <dd>{center.addressDetail}</dd>
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">소속 사용자</h3>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/admin/centers/${centerId}/users`)
                }
              >
                전체 보기
              </Button>
            </div>
            <p className="text-muted-foreground">
              총 {center._count?.users || 0}명의 사용자가 이 센터에 소속되어
              있습니다.
            </p>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">센터 상품</h3>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/admin/centers/${centerId}/products`)
                }
              >
                전체 보기
              </Button>
            </div>
            <p className="text-muted-foreground">
              총 {center._count?.centerStocks || 0}개의 상품이 이 센터에
              재고되어 있습니다.
            </p>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">사용자</p>
                  <p className="text-3xl font-bold">
                    {center._count?.users || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">상품</p>
                  <p className="text-3xl font-bold">
                    {center._count?.centerStocks || 0}
                  </p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">주문</p>
                  <p className="text-3xl font-bold">
                    {center._count?.orders || 0}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>
          </div>

          <Card className="p-6 mt-6">
            <Button
              onClick={() =>
                router.push(`/admin/centers/${centerId}/stats`)
              }
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              상세 통계 보기
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
