"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CameraStream } from "./CameraStream";
import { ScanOverlay } from "./ScanOverlay";
import { ManualInputFallback } from "./ManualInputFallback";
import { ProductDetailsModal } from "./ProductDetailsModal";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useCameraPermission } from "../hooks/useCameraPermission";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, CameraOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScanMode = "INBOUND" | "OUTBOUND" | "LOOKUP";

interface BarcodeScannerContainerProps {
  mode: ScanMode;
}

export function BarcodeScannerContainer({ mode }: BarcodeScannerContainerProps) {
  const [showManualInput, setShowManualInput] = useState(false);
  const { hasPermission, requestPermission, permissionDenied } = useCameraPermission();
  const {
    isScanning,
    scannedProduct,
    error,
    startScanning,
    stopScanning,
    handleBarcodeScan,
    clearProduct,
  } = useBarcodeScanner();

  const handleEnableCamera = async () => {
    const granted = await requestPermission();
    if (granted) {
      startScanning();
    }
  };

  const handleManualSearch = (barcode: string) => {
    handleBarcodeScan(barcode);
    setShowManualInput(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>카메라 스캔</span>
            {hasPermission && isScanning && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualInput(!showManualInput)}
              >
                수동 입력
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Camera Permission Alert */}
          {!hasPermission && !permissionDenied && (
            <Alert className="mb-4">
              <Camera className="h-4 w-4" />
              <AlertDescription>
                바코드를 스캔하려면 카메라 권한이 필요합니다.
                <Button
                  variant="link"
                  onClick={handleEnableCamera}
                  className="ml-2 h-auto p-0"
                >
                  카메라 활성화
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Camera Permission Denied */}
          {permissionDenied && (
            <Alert variant="destructive" className="mb-4">
              <CameraOff className="h-4 w-4" />
              <AlertDescription>
                카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Camera Stream with Overlay */}
          {hasPermission && isScanning && (
            <div className="relative">
              <CameraStream onDetected={handleBarcodeScan} isActive={isScanning} />
              <ScanOverlay isScanning={isScanning} />
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  💡 바코드를 스캔 영역에 맞춰주세요
                </p>
              </div>
            </div>
          )}

          {/* Manual Input Fallback */}
          {showManualInput && (
            <div className="mt-4">
              <ManualInputFallback onSearch={handleManualSearch} />
            </div>
          )}

          {/* No Camera Fallback */}
          {!hasPermission && permissionDenied && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                카메라를 사용할 수 없는 경우 바코드 번호를 직접 입력하세요:
              </p>
              <ManualInputFallback onSearch={handleManualSearch} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Details Modal */}
      {scannedProduct && (
        <ProductDetailsModal
          product={scannedProduct}
          mode={mode}
          open={!!scannedProduct}
          onClose={clearProduct}
        />
      )}
    </>
  );
}
