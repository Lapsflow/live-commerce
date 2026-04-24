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
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<IssuedAccount | null>(
    virtualAccount
      ? {
          accountNumber: virtualAccount,
          bank: virtualAccountBank ?? "",
          amount: totalAmount,
          expiryAt: virtualAccountExpiry ?? "",
        }
      : null
  );
  const [copied, setCopied] = useState(false);

  const isPaid = paymentStatus === "PAID";

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const res = await fetch("/api/payments/create-virtual-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error?.message || data.error || "가상계좌 발급 실패";
        toast.error(msg);
        return;
      }

      setIssued({
        accountNumber: data.data.accountNumber,
        bank: data.data.bank,
        amount: data.data.amount,
        expiryAt: data.data.expiryAt,
      });
      toast.success("가상계좌가 발급되었습니다");
    } catch {
      toast.error("서버 오류가 발생했습니다");
    } finally {
      setIssuing(false);
    }
  };

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

  // 입금 완료 상태
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
        {issued && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">은행</div>
                <div className="font-medium">{issued.bank}</div>
              </div>
              <div>
                <div className="text-muted-foreground">입금액</div>
                <div className="font-medium">
                  {issued.amount.toLocaleString()}원
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // 가상계좌 발급됨
  if (issued) {
    const isExpired =
      issued.expiryAt && new Date(issued.expiryAt) < new Date();

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
                <div className="font-medium">{issued.bank}</div>
              </div>
              <div>
                <div className="text-muted-foreground">입금액</div>
                <div className="font-medium text-blue-700">
                  {issued.amount.toLocaleString()}원
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">
                계좌번호
              </div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-semibold bg-muted px-3 py-1 rounded">
                  {issued.accountNumber}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(issued.accountNumber)}
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {issued.expiryAt && (
              <div className="text-sm">
                <span className="text-muted-foreground">만료시간: </span>
                <span className={isExpired ? "text-red-600" : ""}>
                  {new Date(issued.expiryAt).toLocaleString("ko-KR")}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 가상계좌 미발급 + UNPAID
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <CreditCard className="h-5 w-5 inline mr-2" />
          가상계좌
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          가상계좌를 발급하면 셀러에게 입금 안내가 발송됩니다.
        </p>
        <Button onClick={handleIssue} disabled={issuing}>
          <CreditCard className="h-4 w-4 mr-2" />
          {issuing ? "발급 중..." : "가상계좌 발급"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default VirtualAccountInfo;
