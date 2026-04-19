"use client";

import { useState } from "react";
import { usePriceComparison } from "../hooks/usePriceComparison";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface PriceComparisonCardProps {
  barcode: string;
  ourPrice: number;
}

export function PriceComparisonCard({ barcode, ourPrice }: PriceComparisonCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data, isLoading, error, refetch, isFetching } = usePriceComparison(barcode, ourPrice);

  const getCompetitivenessColor = (level?: string) => {
    switch (level) {
      case "EXCELLENT":
        return "bg-green-100 text-green-800 border-green-300";
      case "GOOD":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "FAIR":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "POOR":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-grey-100 text-grey-800 border-grey-300";
    }
  };

  const getCompetitivenessLabel = (level?: string) => {
    switch (level) {
      case "EXCELLENT":
        return "매우 경쟁력 있음";
      case "GOOD":
        return "경쟁력 있음";
      case "FAIR":
        return "보통";
      case "POOR":
        return "경쟁력 낮음";
      default:
        return "분석 중";
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "-";
    return `${price.toLocaleString()}원`;
  };

  const calculatePriceDiff = () => {
    if (!data?.market?.avgPrice || !ourPrice) return null;
    const diff = ((ourPrice - data.market.avgPrice) / data.market.avgPrice) * 100;
    const isLower = diff < 0;
    return {
      percentage: Math.abs(diff).toFixed(1),
      isLower,
      label: isLower ? "저렴" : "비쌈",
    };
  };

  const priceDiff = calculatePriceDiff();

  return (
    <div className="border border-grey-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-grey-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-grey-900">시장 가격 비교</h3>
          {data?.competitiveness && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded border ${getCompetitivenessColor(
                data.competitiveness
              )}`}
            >
              {getCompetitivenessLabel(data.competitiveness)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(isLoading || isFetching) && (
            <RefreshCw className="w-4 h-4 text-grey-400 animate-spin" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-grey-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-grey-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              가격 정보를 불러오는데 실패했습니다. 다시 시도해주세요.
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8 text-grey-500">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
              <p className="text-sm">가격 정보를 불러오는 중...</p>
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* Our Price Section */}
              <div className={`rounded-lg p-4 border-2 ${
                data.competitiveness === "EXCELLENT"
                  ? "bg-green-50 border-green-300"
                  : data.competitiveness === "POOR"
                  ? "bg-red-50 border-red-300"
                  : data.competitiveness === "GOOD"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-grey-50 border-grey-200"
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-sm font-medium ${
                    data.competitiveness === "EXCELLENT"
                      ? "text-green-700"
                      : data.competitiveness === "POOR"
                      ? "text-red-700"
                      : data.competitiveness === "GOOD"
                      ? "text-blue-600"
                      : "text-grey-600"
                  }`}>우리 판매가</div>
                  {data.competitiveness === "EXCELLENT" && (
                    <span className="text-xs font-bold text-green-700 px-2 py-1 bg-green-200 rounded">
                      🎉 최저가
                    </span>
                  )}
                  {data.competitiveness === "POOR" && (
                    <span className="text-xs font-bold text-red-700 px-2 py-1 bg-red-200 rounded">
                      ⚠️ 경고
                    </span>
                  )}
                </div>
                <div className={`text-2xl font-bold ${
                  data.competitiveness === "EXCELLENT"
                    ? "text-green-900"
                    : data.competitiveness === "POOR"
                    ? "text-red-900"
                    : data.competitiveness === "GOOD"
                    ? "text-blue-900"
                    : "text-grey-900"
                }`}>{formatPrice(ourPrice)}</div>

                {/* PDF Requirement: 판단 메시지 */}
                {data.competitiveness === "EXCELLENT" && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-800 font-medium">
                    ✨ 최저가입니다! 지금 판매하기 좋은 가격입니다.
                  </div>
                )}
                {data.competitiveness === "POOR" && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800 font-medium">
                    ⚠️ 쿠팡보다 20% 이상 비쌉니다. 가격 조정을 고려하세요.
                  </div>
                )}
                {data.competitiveness === "GOOD" && (
                  <div className="mt-2 p-2 bg-blue-100 border border-blue-200 rounded text-sm text-blue-800">
                    ✓ 경쟁력 있는 가격입니다.
                  </div>
                )}

                {priceDiff && (
                  <div className="mt-2 text-sm">
                    <span
                      className={`font-medium ${
                        priceDiff.isLower ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      시장 평균 대비 {priceDiff.isLower ? "-" : "+"}
                      {priceDiff.percentage}% {priceDiff.label}
                    </span>
                    {priceDiff.isLower && (
                      <span className="ml-2 text-green-600">✓</span>
                    )}
                  </div>
                )}
              </div>

              {/* Naver Shopping Section */}
              {data.naver && (
                <div className="border border-grey-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-sm font-semibold text-grey-700">네이버 쇼핑</div>
                    <div className="text-xs text-grey-500">
                      ({data.naver.count || 0}개 상품)
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-grey-500 mb-1">최저가</div>
                      <div className="text-sm font-semibold text-grey-900">
                        {formatPrice(data.naver.minPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-grey-500 mb-1">평균가</div>
                      <div className="text-sm font-semibold text-grey-900">
                        {formatPrice(data.naver.avgPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-grey-500 mb-1">최고가</div>
                      <div className="text-sm font-semibold text-grey-900">
                        {formatPrice(data.naver.maxPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Coupang Section */}
              {data.coupang && (
                <div className="border border-grey-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-sm font-semibold text-grey-700">쿠팡</div>
                    <div className="text-xs text-grey-500">
                      ({data.coupang.count || 0}개 상품)
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-grey-500 mb-1">최저가</div>
                      <div className="text-sm font-semibold text-grey-900">
                        {formatPrice(data.coupang.minPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-grey-500 mb-1">평균가</div>
                      <div className="text-sm font-semibold text-grey-900">
                        {formatPrice(data.coupang.avgPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-grey-500 mb-1">최고가</div>
                      <div className="text-sm font-semibold text-grey-900">
                        {formatPrice(data.coupang.maxPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer - Cache Status and Refresh */}
              <div className="flex items-center justify-between text-xs text-grey-500 pt-2 border-t border-grey-100">
                <div className="flex items-center gap-2">
                  <span>
                    {data.cached ? "캐시된 데이터" : "최신 데이터"}
                  </span>
                  {data.timestamp && (
                    <span>
                      • {new Date(data.timestamp).toLocaleTimeString("ko-KR")}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    refetch();
                  }}
                  disabled={isFetching}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-grey-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
                  <span>새로고침</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
