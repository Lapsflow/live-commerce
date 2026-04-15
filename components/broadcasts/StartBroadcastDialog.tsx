"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CenterInfo {
  id: string;
  code: string;
  name: string;
  region: string;
  productCount: number;
}

interface StartBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broadcastId: string;
  onSuccess: () => void;
}

export function StartBroadcastDialog({
  open,
  onOpenChange,
  broadcastId,
  onSuccess,
}: StartBroadcastDialogProps) {
  const { toast } = useToast();
  const [centerCode, setCenterCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [center, setCenter] = useState<CenterInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateCenterCode = async () => {
    if (!centerCode.trim()) {
      setError("센터코드를 입력하세요");
      return;
    }

    setIsValidating(true);
    setError(null);
    setCenter(null);

    try {
      const res = await fetch("/api/broadcasts/lookup-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: centerCode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.data) {
        setCenter(data.data);
      } else {
        const errorMessage = data.error?.message || "유효하지 않은 센터코드입니다";
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Failed to validate center code:", err);
      setError("센터코드 검증 중 오류가 발생했습니다");
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartBroadcast = async () => {
    if (!center) {
      setError("센터 정보를 먼저 확인하세요");
      return;
    }

    setIsStarting(true);

    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/start`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ centerId: center.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "방송 시작 실패");
      }

      toast({
        title: "방송 시작",
        description: `${center.name} 센터와 연결되어 방송이 시작되었습니다.`,
      });

      // Reset state
      setCenterCode("");
      setCenter(null);
      setError(null);

      // Close dialog and notify parent
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    if (!isStarting && !isValidating) {
      setCenterCode("");
      setCenter(null);
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>방송 시작</DialogTitle>
          <DialogDescription>
            연결할 센터의 센터코드를 입력하세요 (예: 01-4213)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Center Code Input */}
          <div className="flex gap-2">
            <Input
              placeholder="센터코드 입력 (예: 01-4213)"
              value={centerCode}
              onChange={(e) => setCenterCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validateCenterCode()}
              disabled={isValidating || isStarting}
              autoFocus
            />
            <Button
              onClick={validateCenterCode}
              disabled={isValidating || isStarting || !centerCode.trim()}
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "확인"
              )}
            </Button>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Center Info */}
          {center && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertTitle>센터 확인됨</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    <strong>센터코드:</strong> {center.code}
                  </div>
                  <div>
                    <strong>센터명:</strong> {center.name}
                  </div>
                  <div>
                    <strong>지역:</strong> {center.region}
                  </div>
                  <div>
                    <strong>상품 수:</strong> {center.productCount.toLocaleString()}개
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isStarting}>
            취소
          </Button>
          <Button
            onClick={handleStartBroadcast}
            disabled={!center || isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                시작 중...
              </>
            ) : (
              "방송 시작"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
