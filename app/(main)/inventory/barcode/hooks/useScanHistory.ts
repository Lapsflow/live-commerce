"use client";

import { useState, useEffect, useCallback } from "react";

interface ScanHistoryItem {
  id: string;
  barcode: string;
  productName: string | null;
  scanType: "INBOUND" | "OUTBOUND" | "LOOKUP";
  quantity: number | null;
  scannedAt: string;
}

export function useScanHistory(limit: number = 20) {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/inventory/scan-history?limit=${limit}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "스캔 이력 조회 실패");
        return;
      }

      // ok() response format: { data: T }
      setHistory(data.data);
    } catch (err) {
      console.error("[Scan History Error]", err);
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const refresh = useCallback(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    loading,
    error,
    refresh,
  };
}
