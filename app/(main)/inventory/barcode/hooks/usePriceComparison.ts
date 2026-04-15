import { useQuery } from "@tanstack/react-query";

export function usePriceComparison(barcode?: string, ourPrice?: number) {
  return useQuery({
    queryKey: ["priceComparison", barcode],
    queryFn: async () => {
      if (!barcode) throw new Error("Barcode required");

      const params = new URLSearchParams({
        barcode,
        ...(ourPrice && { price: ourPrice.toString() }),
      });

      const response = await fetch(`/api/pricing/compare?${params}`);
      if (!response.ok) throw new Error("Price comparison failed");

      const json = await response.json();
      return json.data;
    },
    enabled: !!barcode,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
}
