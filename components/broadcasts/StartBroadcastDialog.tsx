// components/broadcasts/StartBroadcastDialog.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Center {
  id: string;
  code: string;
  name: string;
  regionName: string;
  _count: {
    users: number;
    centerStocks: number;
    broadcasts: number;
  };
}

interface StartBroadcastDialogProps {
  broadcastId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (centerId: string) => void;
  onStartSuccess?: (centerId: string) => void;
}

export function StartBroadcastDialog({
  broadcastId,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
  onStartSuccess,
}: StartBroadcastDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [centerCode, setCenterCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [center, setCenter] = useState<Center | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateCenterCode = async () => {
    if (!centerCode.trim()) {
      setError('센터코드를 입력해주세요');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch('/api/centers/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: centerCode }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error.message || '센터코드 검증에 실패했습니다');
        setCenter(null);
        return;
      }

      const validation = data.data;

      if (!validation.valid) {
        setError(validation.message);
        setCenter(null);
        return;
      }

      if (!validation.available) {
        // Code exists - use the center
        setCenter(validation.center);
        setError(null);
      } else {
        // Code is available but doesn't exist
        setError('존재하지 않는 센터코드입니다');
        setCenter(null);
      }
    } catch (err) {
      console.error('Failed to validate center code:', err);
      setError('센터코드 검증 중 오류가 발생했습니다');
      setCenter(null);
    } finally {
      setIsValidating(false);
    }
  };

  const startBroadcast = async () => {
    if (!center) return;

    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ centerId: center.id }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error.message || '방송 시작에 실패했습니다');
        return;
      }

      toast.success('방송이 시작되었습니다');
      setOpen(false);

      // Navigate to live broadcast page
      router.push(`/broadcasts/${broadcastId}/live?centerId=${center.id}`);

      // Call success callbacks
      if (onSuccess) {
        onSuccess(center.id);
      }
      if (onStartSuccess) {
        onStartSuccess(center.id);
      }
    } catch (err) {
      console.error('Failed to start broadcast:', err);
      toast.error('방송 시작 중 오류가 발생했습니다');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCenterCode('');
    setCenter(null);
    setError(null);
  };

  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger>
          <Button>방송 시작</Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>방송 시작</DialogTitle>
          <DialogDescription>
            연결할 센터의 센터코드를 입력하세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="예: 01-4213"
              value={centerCode}
              onChange={(e) => setCenterCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  validateCenterCode();
                }
              }}
              disabled={isValidating}
            />
            <Button onClick={validateCenterCode} disabled={isValidating}>
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '확인'
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {center && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>센터 확인됨</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    <strong>센터명:</strong> {center.name}
                  </div>
                  <div>
                    <strong>지역:</strong> {center.regionName}
                  </div>
                  <div>
                    <strong>상품 수:</strong> {center._count.centerStocks}개
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={startBroadcast} disabled={!center}>
            방송 시작
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
