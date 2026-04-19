"use client";

import { useState } from "react";
import { useAIAnalysis } from "../hooks/useAIAnalysis";
import { ChevronDown, ChevronUp, Sparkles, AlertCircle } from "lucide-react";

interface AIInsightsCardProps {
  barcode: string;
}

type TabType = "pricing" | "sales";

export function AIInsightsCard({ barcode }: AIInsightsCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("pricing");
  const { data, isLoading, error, refetch } = useAIAnalysis({ barcode });

  const formatCost = (cost?: number) => {
    if (!cost) return "-";
    return `$${cost.toFixed(3)}`;
  };

  const hasAnalysis = data && !error;
  const rateLimit = data?.rateLimit;

  return (
    <div className="border border-grey-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-grey-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-grey-900">AI 분석 결과</h3>
          {rateLimit && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 border border-purple-300">
              {rateLimit.remaining}/{rateLimit.limit} 남음
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-grey-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-grey-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              AI 분석에 실패했습니다. 다시 시도해주세요.
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-purple-50 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent" />
                <span className="text-purple-900 font-medium">
                  AI가 분석하는 중입니다...
                </span>
              </div>
              <p className="text-sm text-grey-500 mt-2">3-10초 정도 소요됩니다</p>
            </div>
          )}

          {/* Analysis Results */}
          {hasAnalysis && (
            <>
              {/* Tabs */}
              <div className="flex gap-2 border-b border-grey-200">
                <button
                  onClick={() => setActiveTab("pricing")}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === "pricing"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-grey-500 hover:text-grey-700"
                  }`}
                >
                  가격 전략
                </button>
                <button
                  onClick={() => setActiveTab("sales")}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === "sales"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-grey-500 hover:text-grey-700"
                  }`}
                >
                  판매 전략
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === "pricing" && data.pricing && (
                  <>
                    {/* Price Competitiveness */}
                    {data.pricing.competitiveness && (
                      <div className="border border-grey-200 rounded-lg p-4">
                        <div className="font-semibold text-grey-900 mb-2">
                          가격 경쟁력
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-grey-600">점수:</span>
                            <span className="font-semibold text-purple-600">
                              {data.pricing.competitiveness.score}/100
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-grey-600">포지션:</span>
                            <span className="text-sm font-medium text-grey-900">
                              {data.pricing.competitiveness.position === "low"
                                ? "저가"
                                : data.pricing.competitiveness.position === "mid"
                                ? "중가"
                                : "고가"}
                            </span>
                          </div>
                          {data.pricing.competitiveness.insight && (
                            <p className="text-sm text-grey-700 mt-2 leading-relaxed">
                              {data.pricing.competitiveness.insight}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Margin Health */}
                    {data.pricing.marginHealth && (
                      <div className="border border-grey-200 rounded-lg p-4">
                        <div className="font-semibold text-grey-900 mb-2">
                          마진 건강도
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-grey-600">상태:</span>
                            <span
                              className={`text-sm font-medium ${
                                data.pricing.marginHealth.isHealthy
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {data.pricing.marginHealth.isHealthy
                                ? "건강함"
                                : "개선 필요"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-grey-600">
                              현재 마진율:
                            </span>
                            <span className="text-sm font-medium text-grey-900">
                              {data.pricing.marginHealth.currentMarginPercent?.toFixed(
                                1
                              )}
                              %
                            </span>
                          </div>
                          {data.pricing.marginHealth.recommendedMarginPercent && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-grey-600">
                                권장 마진율:
                              </span>
                              <span className="text-sm font-medium text-purple-600">
                                {data.pricing.marginHealth.recommendedMarginPercent.toFixed(
                                  1
                                )}
                                %
                              </span>
                            </div>
                          )}
                          {data.pricing.marginHealth.reasoning && (
                            <p className="text-sm text-grey-700 mt-2 leading-relaxed">
                              {data.pricing.marginHealth.reasoning}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {data.pricing.actionItems &&
                      data.pricing.actionItems.length > 0 && (
                        <div className="border border-grey-200 rounded-lg p-4">
                          <div className="font-semibold text-grey-900 mb-2">
                            실행 과제
                          </div>
                          <ul className="space-y-2">
                            {data.pricing.actionItems.map((item: string, index: number) => (
                              <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-grey-700"
                              >
                                <span className="text-purple-600 mt-0.5">•</span>
                                <span className="leading-relaxed">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </>
                )}

                {activeTab === "sales" && data.sales && (
                  <>
                    {/* Key Points */}
                    {data.sales.keyPoints && data.sales.keyPoints.length > 0 && (
                      <div className="border border-grey-200 rounded-lg p-4">
                        <div className="font-semibold text-grey-900 mb-2">
                          주요 포인트
                        </div>
                        <ul className="space-y-2">
                          {data.sales.keyPoints.map((point: string, index: number) => (
                            <li
                              key={index}
                              className="flex items-start gap-2 text-sm text-grey-700"
                            >
                              <span className="text-purple-600 mt-0.5">•</span>
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Target Customer */}
                    {data.sales.targetCustomer && (
                      <div className="border border-grey-200 rounded-lg p-4">
                        <div className="font-semibold text-grey-900 mb-2">
                          타겟 고객
                        </div>
                        <p className="text-sm text-grey-700 leading-relaxed">
                          {data.sales.targetCustomer}
                        </p>
                      </div>
                    )}

                    {/* Broadcast Script */}
                    {data.sales.broadcastScript && (
                      <div className="border border-grey-200 rounded-lg p-4">
                        <div className="font-semibold text-grey-900 mb-2">
                          방송 스크립트 제안
                        </div>
                        <div className="text-sm text-grey-700 leading-relaxed whitespace-pre-line">
                          {data.sales.broadcastScript}
                        </div>
                      </div>
                    )}

                    {/* Recommended Bundles */}
                    {data.sales.recommendedBundles &&
                      data.sales.recommendedBundles.length > 0 && (
                        <div className="border border-grey-200 rounded-lg p-4">
                          <div className="font-semibold text-grey-900 mb-2">
                            추천 묶음 상품
                          </div>
                          <ul className="space-y-2">
                            {data.sales.recommendedBundles.map((bundle: string, index: number) => (
                              <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-grey-700"
                              >
                                <span className="text-purple-600 mt-0.5">•</span>
                                <span className="leading-relaxed">{bundle}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Cautions */}
                    {data.sales.cautions && data.sales.cautions.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          주의사항
                        </div>
                        <ul className="space-y-2">
                          {data.sales.cautions.map((caution: string, index: number) => (
                            <li
                              key={index}
                              className="flex items-start gap-2 text-sm text-yellow-800"
                            >
                              <span className="text-yellow-600 mt-0.5">•</span>
                              <span className="leading-relaxed">{caution}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer - Metadata */}
              <div className="border-t border-grey-100 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-grey-500">
                  <div className="flex items-center gap-2">
                    <span>토큰 사용량: {data.metadata?.tokensUsed || 0}</span>
                    <span>•</span>
                    <span>예상 비용: {formatCost(data.metadata?.estimatedCost)}</span>
                  </div>
                  <div>
                    {data.metadata?.cached && (
                      <span className="text-green-600">캐시됨</span>
                    )}
                  </div>
                </div>
                {data.metadata?.timestamp && (
                  <div className="text-xs text-grey-500">
                    분석 시각:{" "}
                    {new Date(data.metadata.timestamp).toLocaleString("ko-KR")}
                  </div>
                )}
                <button
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="w-full mt-2 px-3 py-2 text-sm border border-grey-300 rounded hover:bg-grey-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  재분석
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
