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
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/constants/role-labels";

type Center = {
  id: string;
  name: string;
  code: string;
};

type UserAddDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** 현재 로그인한 사용자 역할 */
  currentUserRole: string;
  /** 현재 로그인한 사용자의 센터ID (SUB_MASTER인 경우) */
  currentUserCenterId?: string | null;
};

export function UserAddDialog({
  open,
  onOpenChange,
  onSuccess,
  currentUserRole,
  currentUserCenterId,
}: UserAddDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    phone: "",
    role: "SELLER",
    centerId: "",
  });

  // 센터 목록 로드 (MASTER만)
  useEffect(() => {
    if (open && currentUserRole === "MASTER") {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((json) => {
          if (json.data) {
            setCenters(Array.isArray(json.data) ? json.data : []);
          }
        })
        .catch(() => {});
    }
  }, [open, currentUserRole]);

  // Dialog 열릴 때 폼 초기화
  useEffect(() => {
    if (open) {
      setFormData({
        username: "",
        password: "",
        name: "",
        email: "",
        phone: "",
        role: "SELLER",
        centerId: currentUserCenterId || "",
      });
      setError(null);
    }
  }, [open, currentUserCenterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          role: formData.role,
          centerId: formData.centerId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "사용자 생성에 실패했습니다");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "사용자 생성 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const isMaster = currentUserRole === "MASTER";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>사용자 추가</DialogTitle>
          <DialogDescription>
            새로운 사용자를 등록합니다. 생성 즉시 로그인 가능합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 아이디 */}
            <div className="space-y-2">
              <Label htmlFor="add-username">아이디 *</Label>
              <Input
                id="add-username"
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="3자 이상"
                required
                minLength={3}
              />
            </div>

            {/* 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="add-password">비밀번호 *</Label>
              <Input
                id="add-password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="8자 이상"
                required
                minLength={8}
              />
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="add-name">이름 *</Label>
              <Input
                id="add-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="add-email">이메일 *</Label>
              <Input
                id="add-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="user@example.com"
                required
              />
            </div>

            {/* 전화번호 */}
            <div className="space-y-2">
              <Label htmlFor="add-phone">전화번호</Label>
              <Input
                id="add-phone"
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="010-1234-5678"
              />
            </div>

            {/* 역할 (MASTER만 변경 가능) */}
            <div className="space-y-2">
              <Label htmlFor="add-role">역할 *</Label>
              {isMaster ? (
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value || "SELLER" })
                  }
                >
                  <SelectTrigger>
                    {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                    <span>
                      {ROLE_LABELS[formData.role as keyof typeof ROLE_LABELS] ?? formData.role}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELLER">{ROLE_LABELS["SELLER"]}</SelectItem>
                    <SelectItem value="SUB_MASTER">{ROLE_LABELS["SUB_MASTER"]}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value="셀러"
                  disabled
                  className="bg-grey-100"
                />
              )}
            </div>

            {/* 센터 선택 (MASTER만) */}
            {isMaster && centers.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="add-center">소속 센터</Label>
                <Select
                  value={formData.centerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, centerId: value === "none" ? "" : (value || "") })
                  }
                >
                  <SelectTrigger>
                    {/* base-ui SelectValue 는 원시값을 노출 → 라벨 직접 렌더 (2026-07-10) */}
                    <span className={formData.centerId ? "" : "text-grey-500"}>
                      {formData.centerId
                        ? (() => {
                            const c = centers.find((c) => c.id === formData.centerId);
                            return c ? `${c.name} (${c.code})` : formData.centerId;
                          })()
                        : "센터 선택"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              {loading ? "생성 중..." : "사용자 생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
