"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface VirtualAccountInfoProps {
  orderId: string;
  virtualAccount?: string | null;
  virtualAccountBank?: string | null;
  virtualAccountExpiry?: string | null;
  paymentStatus: string;
  totalAmount: number;
}

interface IssuedAccount {
  accountNumber: string;
  bank: string;
  amount: number;
  expiryAt: string;
}

export function VirtualAccountInfo({
  orderId,
  virtualAccount,
  virtualAccountBank,
  virtualAccountExpiry,
  paymentStatus,
  totalAmount,
}: VirtualAccountInfoProps) {
  // ✅ Task 2H: 환경 변수에서 가상계좌 정보 가져오기
  const accountNumber = process.env.NEXT_PUBLIC_VIRTUAL_ACCOUNT_NUMBER || "054-141023-04-013";
  const bank = process.env.NEXT_PUBLIC_VIRTUAL_ACCOUNT_BANK || "기업은행";
  const holder = process.env.NEXT_PUBLIC_VIRTUAL_ACCOUNT_HOLDER || "한국무진유통";

  // 입금 기한은 virtualAccountExpiry (confirm endpoint에서 저장됨)
  const expiryAt = virtualAccountExpiry;

  const [copied, setCopied] = useState(false);

  const isPaid = paymentStatus === "PAID";

  // ✅ Task 2H: 발급 기능 제거 (더 이상 Toss API 사용 안 함)

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("계좌번호가 복사되었습니다");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다");
    }
  };

  // ✅ Task 2H: 입금 완료 상태
  if (isPaid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              <CreditCard className="h-5 w-5 inline mr-2" />
              결제 정보
            </span>
            <Badge className="bg-green-100 text-green-800">입금 완료</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">은행</div>
              <div className="font-medium">{bank}</div>
            </div>
            <div>
              <div className="text-muted-foreground">입금액</div>
              <div className="font-medium">{totalAmount.toLocaleString()}원</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ✅ Task 2H: 가상계좌 안내 (환경 변수 기반)
  const isExpired = expiryAt && new Date(expiryAt) < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            <CreditCard className="h-5 w-5 inline mr-2" />
            가상계좌 안내
          </span>
          {isExpired ? (
            <Badge className="bg-red-100 text-red-800">만료됨</Badge>
          ) : (
            <Badge className="bg-blue-100 text-blue-800">입금 대기</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">은행</div>
              <div className="font-medium">{bank}</div>
            </div>
            <div>
              <div className="text-muted-foreground">입금액</div>
              <div className="font-medium text-blue-700">
                {totalAmount.toLocaleString()}원
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">계좌번호</div>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-semibold bg-muted px-3 py-1 rounded">
                {accountNumber}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(accountNumber)}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">예금주</div>
            <div className="font-medium">{holder}</div>
          </div>

          {expiryAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">입금 기한: </span>
              <span className={isExpired ? "text-red-600" : ""}>
                {new Date(expiryAt).toLocaleString("ko-KR")}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default VirtualAccountInfo;
