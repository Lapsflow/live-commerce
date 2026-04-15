"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Sparkles,
  Users,
  Mic,
  Package,
  AlertTriangle,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AIAnalysisCardProps {
  barcode: string;
  productName: string;
}

interface AIAnalysis {
  productId: string;
  barcode: string;
  productName: string;
  pricing: {
    competitiveness: {
      score: number;
      position: "low" | "mid" | "high";
      insights: string[];
    };
    marginHealth: {
      isHealthy: boolean;
      currentMargin: number;
      recommendedMargin: number;
      reasoning: string;
    };
    actionItems: string[];
  };
  sales: {
    keyPoints: string[];
    targetCustomer: string;
    broadcastScript: string;
    recommendedBundle: string[];
    cautions: string[];
  };
  metadata: {
    analyzedAt: string;
    tokensUsed: number;
    estimatedCost: number;
    cached: boolean;
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen: boolean;
}

const sections: Section[] = [
  { id: "keyPoints", title: "핵심 포인트", icon: Sparkles, defaultOpen: true },
  { id: "targetCustomer", title: "타겟 고객", icon: Users, defaultOpen: true },
  {
    id: "broadcastScript",
    title: "방송 멘트",
    icon: Mic,
    defaultOpen: true,
  },
  {
    id: "recommendedBundle",
    title: "추천 세트 상품",
    icon: Package,
    defaultOpen: false,
  },
  { id: "cautions", title: "주의사항", icon: AlertTriangle, defaultOpen: false },
];

export function AIAnalysisCard({ barcode, productName }: AIAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    keyPoints: true,
    targetCustomer: true,
    broadcastScript: true,
    recommendedBundle: false,
    cautions: false,
  });

  useEffect(() => {
    // Auto-trigger analysis on barcode change
    if (barcode) {
      analyzeProduct();
    }
  }, [barcode]);

  const analyzeProduct = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ barcode }),
      });

      const data = await res.json();

      if (res.ok && data.data) {
        setAnalysis(data.data);
        toast.success("AI 분석 완료!");
      } else {
        const errorMessage =
          data.error?.message || "AI 분석 중 오류가 발생했습니다";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error("AI analysis error:", err);
      setError("AI 분석 중 오류가 발생했습니다");
      toast.error("AI 분석 중 오류가 발생했습니다");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("클립보드에 복사되었습니다");
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>AI 분석</CardTitle>
            <Badge variant="secondary" className="text-xs">
              자동 생성
            </Badge>
          </div>
          {analysis?.metadata.cached && (
            <Badge variant="outline" className="text-xs">
              캐시됨
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI가 분석 중...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="text-red-600 text-sm">{error}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeProduct}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              다시 분석
            </Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Key Points */}
            <Collapsible
              open={openSections.keyPoints}
              onOpenChange={() => toggleSection("keyPoints")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-semibold">핵심 포인트</span>
                </div>
                {openSections.keyPoints ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.sales.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm">
                      {point}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Target Customer */}
            <Collapsible
              open={openSections.targetCustomer}
              onOpenChange={() => toggleSection("targetCustomer")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-semibold">타겟 고객</span>
                </div>
                {openSections.targetCustomer ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-sm">{analysis.sales.targetCustomer}</p>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Broadcast Script */}
            <Collapsible
              open={openSections.broadcastScript}
              onOpenChange={() => toggleSection("broadcastScript")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  <span className="font-semibold">방송 멘트</span>
                </div>
                {openSections.broadcastScript ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="relative">
                  <p className="text-sm bg-muted p-4 rounded-md">
                    {analysis.sales.broadcastScript}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() =>
                      copyToClipboard(analysis.sales.broadcastScript)
                    }
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Recommended Bundle */}
            <Collapsible
              open={openSections.recommendedBundle}
              onOpenChange={() => toggleSection("recommendedBundle")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold">추천 세트 상품</span>
                </div>
                {openSections.recommendedBundle ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.sales.recommendedBundle.map((item, i) => (
                    <li key={i} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Cautions */}
            <Collapsible
              open={openSections.cautions}
              onOpenChange={() => toggleSection("cautions")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="font-semibold">주의사항</span>
                </div>
                {openSections.cautions ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.sales.cautions.map((caution, i) => (
                    <li key={i} className="text-sm text-destructive">
                      {caution}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>

            {/* Metadata */}
            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  토큰 사용: {analysis.metadata.tokensUsed.toLocaleString()}
                </span>
                <span>
                  비용: ${analysis.metadata.estimatedCost.toFixed(4)}
                </span>
              </div>
              {analysis.rateLimit && (
                <div className="mt-2">
                  <span>
                    남은 요청: {analysis.rateLimit.remaining}/
                    {analysis.rateLimit.limit}
                  </span>
                </div>
              )}
            </div>

            {/* Re-analyze Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeProduct}
              className="w-full mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              재분석
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">바코드를 스캔하면 AI 분석이 시작됩니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
