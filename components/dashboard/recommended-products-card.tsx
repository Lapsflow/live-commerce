"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StarIcon, PackageIcon } from "lucide-react";

interface Recommendation {
  product: {
    id: string;
    name: string;
    code: string;
    barcode: string;
    sellPrice: number;
    supplyPrice: number;
  };
  score: number;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  lastOrderAt: string;
}

interface RecommendedProductsCardProps {
  sellerId: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return `${Math.floor(diffDays / 30)}개월 전`;
}

function ScoreBadge({ score }: { score: number }) {
  const rounded = Math.round(score);
  if (rounded >= 70) {
    return <Badge className="bg-green-100 text-green-800">{rounded}점</Badge>;
  }
  if (rounded >= 50) {
    return <Badge className="bg-yellow-100 text-yellow-800">{rounded}점</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-800">{rounded}점</Badge>;
}

export function RecommendedProductsCard({
  sellerId,
}: RecommendedProductsCardProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/sellers/${sellerId}/recommended-products?minScore=30&limit=10`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setRecommendations(data.data?.recommendations ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("추천 상품을 불러올 수 없습니다");
        setLoading(false);
      });
  }, [sellerId]);

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (error) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">
          <StarIcon className="h-5 w-5 inline mr-2 text-yellow-500" />
          추천 상품
        </h2>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">
        <StarIcon className="h-5 w-5 inline mr-2 text-yellow-500" />
        추천 상품
      </h2>

      {recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <PackageIcon className="h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">아직 추천 상품이 없습니다.</p>
          <p className="text-xs mt-1">
            주문 완료 후 자동으로 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">상품명</th>
                <th className="pb-2 font-medium text-center">RFM 점수</th>
                <th className="pb-2 font-medium text-right">주문횟수</th>
                <th className="pb-2 font-medium text-right">총수량</th>
                <th className="pb-2 font-medium text-right">최근주문</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => (
                <tr
                  key={rec.product.id}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="py-2">
                    <Link
                      href={`/products/${rec.product.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {rec.product.name}
                    </Link>
                  </td>
                  <td className="py-2 text-center">
                    <ScoreBadge score={rec.score} />
                  </td>
                  <td className="py-2 text-right">
                    {rec.orderCount.toLocaleString()}회
                  </td>
                  <td className="py-2 text-right">
                    {rec.totalQuantity.toLocaleString()}개
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {formatRelativeDate(rec.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
