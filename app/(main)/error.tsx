"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">문제가 발생했습니다</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          페이지를 불러오는 중 오류가 발생했습니다. 다시 시도하거나 잠시 후에 접속해주세요.
        </p>
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        다시 시도
      </Button>
    </div>
  );
}
