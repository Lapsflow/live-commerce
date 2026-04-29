"use client";

import { useState, useCallback } from "react";
import { playBeep } from "@/lib/utils/sound";

interface ProductData {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  minSellPrice?: number | null;
  maxSellPrice?: number | null;
  totalStock: number;
  centerStocks: Array<{
    centerId: string;
    centerCode: string;
    centerName: string;
    regionName: string;
    stock: number;
    location: string | null;
  }>;
  // ONEWMS 실시간 재고 필드
  realtimeStock: number | null;
  cachedStock: number;
  stockError: string | null;
  lastSyncedAt: string | null;
}

export function useBarcodeScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ProductData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    setError(null);
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    try {
      setError(null);

      const response = await fetch(`/api/products/barcode/${barcode}`);
      const data = await response.json();

      if (!response.ok) {
        playBeep("error"); // BARCODE-02: 실패 사운드
        if (response.status === 404) {
          setError(`바코드 ${barcode}에 해당하는 상품을 찾을 수 없습니다.`);
        } else {
          setError(data.error || "상품 조회 중 오류가 발생했습니다.");
        }
        return;
      }

      // BARCODE-02: 상품 조회 성공 사운드
      playBeep("success");
      // ok() response format: { data: T }
      setScannedProduct(data.data);

      // ONEWMS 재고 조회 실패 시 경고 (상품은 찾았지만 실시간 재고 못 가져옴)
      if (data.data?.stockError) {
        setError(`실시간 재고 조회 실패: ${data.data.stockError}`);
      }
    } catch (err) {
      console.error("[Barcode Scan Error]", err);
      setError("네트워크 오류가 발생했습니다.");
    }
  }, []);

  const refreshProduct = useCallback(async (barcode: string) => {
    try {
      const response = await fetch(`/api/products/barcode/${barcode}`);
      const data = await response.json();
      if (response.ok && data.data) {
        setScannedProduct(data.data);
      }
    } catch (err) {
      console.error("[Barcode Refresh Error]", err);
    }
  }, []);

  const updateProduct = useCallback((updatedProduct: ProductData) => {
    setScannedProduct(updatedProduct);
  }, []);

  const clearProduct = useCallback(() => {
    setScannedProduct(null);
    setError(null);
  }, []);

  return {
    isScanning,
    scannedProduct,
    error,
    startScanning,
    stopScanning,
    handleBarcodeScan,
    refreshProduct,
    updateProduct,
    clearProduct,
  };
}
