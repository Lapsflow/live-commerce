import { useMutation } from "@tanstack/react-query";

export function useAIAnalysis() {
  return useMutation({
    mutationFn: async ({
      barcode,
      skipCache = false,
    }: {
      barcode: string;
      skipCache?: boolean;
    }) => {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, skipCache }),
      });

      if (!response.ok) throw new Error("AI analysis failed");

      const json = await response.json();
      return json.data;
    },
  });
}
