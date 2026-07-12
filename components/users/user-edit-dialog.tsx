"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/constants/role-labels";
import { SELLER_PAYMENT_METHOD_LABELS } from "@/lib/constants/order-labels";

type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  channels: string[];
  avgSales: number | null;
  paymentMethod?: string | null;
  paymentNotes?: string | null;
};

type UserEditDialogProps = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function UserEditDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "SELLER",
    channels: "",
    avgSales: "",
    paymentMethod: "PREPAID",
    paymentNotes: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        role: user.role || "SELLER",
        channels: user.channels?.join(", ") || "",
        avgSales: user.avgSales?.toString() || "",
        paymentMethod: user.paymentMethod || "PREPAID",
        paymentNotes: user.paymentNotes || "",
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const updateData: any = {
        name: formData.name,
        phone: formData.phone || null,
        role: formData.role,
        channels: formData.channels
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c),
        avgSales: formData.avgSales ? parseInt(formData.avgSales) : null,
        // 발주관리 개선(2026-07-10, 요청 5번)
        paymentMethod: formData.paymentMethod,
        paymentNotes: formData.paymentNotes || null,
      };

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "사용자 정보 수정에 실패했습니다");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("User update error:", err);
      setError(err.message || "사용자 정보 수정 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>사용자 정보 수정</DialogTitle>
          <DialogDescription>
            사용자의 정보를 수정합니다. 이메일은 변경할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 이메일 (읽기 전용) */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-grey-100"
              />
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            {/* 전화번호 */}
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <Input
                id="phone"
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="010-1234-5678"
              />
            </div>

            {/* 역할 */}
            <div className="space-y-2">
              <Label htmlFor="role">역할 *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value || "SELLER" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASTER">{ROLE_LABELS["MASTER"]}</SelectItem>
                  <SelectItem value="SUB_MASTER">{ROLE_LABELS["SUB_MASTER"]}</SelectItem>
                  <SelectItem value="SELLER">{ROLE_LABELS["SELLER"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 활동 채널 (SELLER만) */}
            {formData.role === "SELLER" && (
              <div className="space-y-2">
                <Label htmlFor="channels">활동 채널</Label>
                <Input
                  id="channels"
                  type="text"
                  value={formData.channels}
                  onChange={(e) =>
                    setFormData({ ...formData, channels: e.target.value })
                  }
                  placeholder="쿠팡, 네이버, 카카오 (쉼표로 구분)"
                />
                <p className="text-xs text-grey-500">
                  여러 채널은 쉼표(,)로 구분하세요
                </p>
              </div>
            )}

            {/* 평균 매출 (SELLER만) */}
            {formData.role === "SELLER" && (
              <div className="space-y-2">
                <Label htmlFor="avgSales">평균 매출 (원)</Label>
                <Input
                  id="avgSales"
                  type="number"
                  value={formData.avgSales}
                  onChange={(e) =>
                    setFormData({ ...formData, avgSales: e.target.value })
                  }
                  placeholder="1000000"
                />
              </div>
            )}

            {/* 결제방식 (SELLER만 — 발주관리 개선 2026-07-10, 요청 5번) */}
            {formData.role === "SELLER" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">결제방식</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMethod: value || "PREPAID" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SELLER_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-grey-500">
                    월결제·후불결제 셀러는 발주 승인 시 외상거래(입금 전 출고)로 자동 처리됩니다
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentNotes">정산 메모</Label>
                  <Input
                    id="paymentNotes"
                    type="text"
                    value={formData.paymentNotes}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentNotes: e.target.value })
                    }
                    placeholder="예: 매월 말 결제, 익월 10일 결제, 거래처 협의"
                  />
                </div>
              </>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
