"use client";

interface ScanOverlayProps {
  isScanning: boolean;
}

export function ScanOverlay({ isScanning }: ScanOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Scan Frame */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`
            relative w-3/4 h-1/2 border-4 rounded-lg
            ${isScanning ? "border-green-500 animate-pulse" : "border-white"}
          `}
        >
          {/* Corner Markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg -mt-1 -ml-1" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg -mt-1 -mr-1" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg -mb-1 -ml-1" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg -mb-1 -mr-1" />

          {/* Scanning Line Animation */}
          {isScanning && (
            <div className="absolute left-0 right-0 h-0.5 bg-green-500 animate-scan-line" />
          )}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
        <div
          className={`
            px-4 py-2 rounded-full text-sm font-medium
            ${
              isScanning
                ? "bg-green-500 text-white"
                : "bg-gray-800 text-gray-300"
            }
          `}
        >
          {isScanning ? "스캔 중..." : "준비"}
        </div>
      </div>
    </div>
  );
}
