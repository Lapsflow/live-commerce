"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  TrendingDown,
  ThumbsUp,
  Minus,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";

interface PricingInfoCardProps {
  barcode: string;
  ourPrice: number;
}

interface PricingData {
  barcode: string;
  naver: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    count: number;
  } | null;
  coupang: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    count: number;
  } | null;
  market: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
  };
  competitiveness: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  fetchedAt: string;
  cached: boolean;
}

const competitivenessBadge = {
  EXCELLENT: {
    color: "default" as const,
    icon: TrendingDown,
    text: "최저가급!",
    textColor: "text-green-600",
  },
  GOOD: {
    color: "default" as const,
    icon: ThumbsUp,
    text: "저렴함",
    textColor: "text-blue-600",
  },
  FAIR: {
    color: "secondary" as const,
    icon: Minus,
    text: "보통",
    textColor: "text-yellow-600",
  },
  POOR: {
    color: "destructive" as const,
    icon: AlertTriangle,
    text: "비쌈",
    textColor: "text-red-600",
  },
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PricingInfoCard({ barcode, ourPrice }: PricingInfoCardProps) {
  const { data, error, isLoading, mutate } = useSWR<{ data: PricingData }>(
    `/api/pricing/compare?barcode=${encodeURIComponent(barcode)}&price=${ourPrice}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600000, // 1 hour
    }
  );

  const pricingData = data?.data;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>시세 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">
            시세 정보를 불러올 수 없습니다
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => mutate()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !pricingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>시세 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const priceGap = ourPrice - pricingData.market.avgPrice;
  const priceGapPercent = pricingData.market.avgPrice > 0
    ? ((priceGap / pricingData.market.avgPrice) * 100).toFixed(1)
    : "0";

  const badge = competitivenessBadge[pricingData.competitiveness];
  const BadgeIcon = badge.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>시세 정보</CardTitle>
          {pricingData.cached && (
            <Badge variant="outline" className="text-xs">
              캐시됨
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Naver */}
          {pricingData.naver && (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  네이버 최저가
                </div>
                <div className="text-lg font-bold">
                  {pricingData.naver.minPrice.toLocaleString()}원
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  네이버 평균
                </div>
                <div className="text-lg font-bold">
                  {pricingData.naver.avgPrice.toLocaleString()}원
                </div>
              </div>
            </>
          )}

          {/* Coupang */}
          {pricingData.coupang && (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  쿠팡 최저가
                </div>
                <div className="text-lg font-bold">
                  {pricingData.coupang.minPrice.toLocaleString()}원
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  쿠팡 평균
                </div>
                <div className="text-lg font-bold">
                  {pricingData.coupang.avgPrice.toLocaleString()}원
                </div>
              </div>
            </>
          )}

          {/* Market Average */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              시장 평균
            </div>
            <div className="text-lg font-bold">
              {pricingData.market.avgPrice.toLocaleString()}원
            </div>
          </div>

          {/* Our Price */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              우리 가격
            </div>
            <div className="text-lg font-bold text-primary">
              {ourPrice.toLocaleString()}원
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Competitiveness Badge */}
        <div className="flex items-center gap-3">
          <Badge variant={badge.color} className="flex items-center gap-1">
            <BadgeIcon className="w-4 h-4" />
            {badge.text}
          </Badge>
          <span className={`text-sm font-medium ${badge.textColor}`}>
            시장가 대비 {priceGapPercent > "0" ? "+" : ""}
            {priceGapPercent}%
          </span>
        </div>

        {/* Price Analysis */}
        <div className="mt-4 text-xs text-muted-foreground">
          {pricingData.competitiveness === "EXCELLENT" && (
            <p>시장 최저가급으로 매우 경쟁력 있는 가격입니다!</p>
          )}
          {pricingData.competitiveness === "GOOD" && (
            <p>시장 평균보다 저렴하여 가격 경쟁력이 있습니다.</p>
          )}
          {pricingData.competitiveness === "FAIR" && (
            <p>시장 평균 수준의 적정한 가격입니다.</p>
          )}
          {pricingData.competitiveness === "POOR" && (
            <p>시장 평균보다 높은 가격입니다. 가격 조정을 고려하세요.</p>
          )}
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4"
          onClick={() => mutate()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          시세 새로고침
        </Button>
      </CardContent>
    </Card>
  );
}
