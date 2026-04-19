import { useQuery } from "@tanstack/react-query";

interface UseAIAnalysisOptions {
  barcode: string;
  skipCache?: boolean;
  enabled?: boolean;
}

export function useAIAnalysis({ barcode, skipCache = false, enabled = true }: UseAIAnalysisOptions) {
  return useQuery({
    queryKey: ["ai-analysis", barcode, skipCache],
    queryFn: async () => {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, skipCache }),
      });

      if (!response.ok) throw new Error("AI analysis failed");

      const json = await response.json();
      return json.data;
    },
    enabled: enabled && !!barcode,
    staleTime: skipCache ? 0 : 1000 * 60 * 60, // 1 hour cache unless skipCache
    retry: 1,
  });
}
