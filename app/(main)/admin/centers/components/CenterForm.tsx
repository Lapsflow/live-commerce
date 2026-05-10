"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Card } from "@/components/ui/card";
import { Loader2, Save, RefreshCw, CheckCircle, XCircle } from "lucide-react";

// 17 regions in South Korea
const REGIONS = [
  { code: "01", name: "서울특별시" },
  { code: "02", name: "경기도" },
  { code: "03", name: "인천광역시" },
  { code: "04", name: "강원특별자치도" },
  { code: "05", name: "충청북도" },
  { code: "06", name: "충청남도" },
  { code: "07", name: "대전광역시" },
  { code: "08", name: "세종특별자치시" },
  { code: "09", name: "전북특별자치도" },
  { code: "10", name: "전라남도" },
  { code: "11", name: "광주광역시" },
  { code: "12", name: "경상북도" },
  { code: "13", name: "경상남도" },
  { code: "14", name: "대구광역시" },
  { code: "15", name: "울산광역시" },
  { code: "16", name: "부산광역시" },
  { code: "17", name: "제주특별자치도" },
];

/** 혼동 문자(l,1,o,0,i) 제외 임시 비밀번호 생성 */
function generateTemporaryPassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

// Form validation schema
// edit 모드에서는 adminUsername / adminPassword 입력 칸이 렌더되지 않으므로
// 두 필드는 schema 차원에서 optional. create 모드에서는 UI에서 required로 처리.
const centerFormSchema = z.object({
  regionCode: z.string().min(1, "지역을 선택하세요"),
  phoneCode: z
    .string()
    .min(4, "4자리 숫자를 입력하세요")
    .max(4, "4자리 숫자를 입력하세요")
    .regex(/^\d{4}$/, "숫자만 입력 가능합니다"),
  name: z.string().min(2, "센터명은 2자 이상이어야 합니다"),
  representative: z.string().min(2, "대표자 이름은 2자 이상이어야 합니다"),
  representativePhone: z
    .string()
    .regex(/^010-\d{4}-\d{4}$/, "010-XXXX-XXXX 형식으로 입력하세요"),
  address: z.string().min(5, "주소를 입력하세요"),
  addressDetail: z.string().optional(),
  businessNo: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{5}$/, "XXX-XX-XXXXX 형식으로 입력하세요")
    .optional()
    .or(z.literal("")),
  // 관리자 계정 (create 모드에서 필수, edit 모드에서는 사용 안함)
  adminUsername: z.string().min(3, "아이디는 3자 이상이어야 합니다").max(50).optional().or(z.literal("")),
  adminPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다").optional().or(z.literal("")),
});

type CenterFormValues = z.infer<typeof centerFormSchema>;

interface AdminResult {
  username: string;
  temporaryPassword: string;
  name: string;
}

interface CenterFormProps {
  initialData?: any;
  onSuccess?: (adminResult?: AdminResult) => void;
  onCancel?: () => void;
}

export function CenterForm({
  initialData,
  onSuccess,
  onCancel,
}: CenterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const isEditMode = !!initialData;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CenterFormValues>({
    resolver: zodResolver(centerFormSchema),
    defaultValues: initialData
      ? {
          regionCode: initialData.regionCode,
          phoneCode: initialData.code.split("-")[1],
          name: initialData.name,
          representative: initialData.representative,
          representativePhone: initialData.representativePhone,
          address: initialData.address,
          addressDetail: initialData.addressDetail || "",
          businessNo: initialData.businessNo || "",
        }
      : undefined,
  });

  const regionCode = watch("regionCode");
  const phoneCode = watch("phoneCode");
  const adminUsername = watch("adminUsername");

  // 아이디 중복 체크 (debounced)
  const checkUsernameAvailability = useCallback(async (uname: string) => {
    if (!uname || uname.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(uname)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsernameAvailable(data.data.available);
      }
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  useEffect(() => {
    if (!adminUsername || adminUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(() => checkUsernameAvailability(adminUsername), 500);
    return () => clearTimeout(timer);
  }, [adminUsername, checkUsernameAvailability]);

  // Auto-generate center code
  useEffect(() => {
    if (regionCode && phoneCode && phoneCode.length === 4) {
      const code = `${regionCode}-${phoneCode}`;
      setGeneratedCode(code);

      // Check code availability
      if (!isEditMode || code !== initialData?.code) {
        checkCodeAvailability(code);
      } else {
        setCodeAvailable(true); // Current code is always available in edit mode
      }
    } else {
      setGeneratedCode("");
      setCodeAvailable(null);
    }
  }, [regionCode, phoneCode, isEditMode, initialData]);

  const checkCodeAvailability = async (code: string) => {
    try {
      const res = await fetch(
        `/api/centers/check-available?code=${encodeURIComponent(code)}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setCodeAvailable(data.data.available);
      }
    } catch (err) {
      console.error("Failed to check code availability:", err);
    }
  };

  const onSubmit = async (values: CenterFormValues) => {
    setLoading(true);
    setError(null);

    try {
      const regionName =
        REGIONS.find((r) => r.code === values.regionCode)?.name || "";
      const code = `${values.regionCode}-${values.phoneCode}`;

      const payload: Record<string, any> = {
        code,
        name: values.name,
        regionCode: values.regionCode,
        regionName,
        representative: values.representative,
        representativePhone: values.representativePhone,
        address: values.address,
        addressDetail: values.addressDetail || undefined,
        businessNo: values.businessNo || undefined,
      };

      // 관리자 계정 정보 (create 모드에서 필수)
      // 관리자 이름은 센터 대표자 이름을 그대로 사용
      // 연락처는 센터 대표자 연락처를 그대로 사용
      if (!isEditMode) {
        if (!values.adminUsername || !values.adminPassword) {
          setError("관리자 아이디와 비밀번호는 필수입니다");
          setLoading(false);
          return;
        }
        payload.adminUsername = values.adminUsername;
        payload.adminPassword = values.adminPassword;
        payload.adminName = values.representative;
        payload.adminPhone = values.representativePhone;
      }

      const url = isEditMode
        ? `/api/centers/${initialData.id}`
        : "/api/centers";
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess?.(data.data?.admin ?? undefined);
      } else {
        setError(data.error?.message || "저장에 실패했습니다");
      }
    } catch (err) {
      console.error("Failed to save center:", err);
      setError("저장 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Center Code Generation */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">센터코드 생성</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="regionCode">지역 선택 *</Label>
            <Select
              value={watch("regionCode")}
              onValueChange={(value) => value && setValue("regionCode", value)}
              disabled={isEditMode}
            >
              <SelectTrigger id="regionCode">
                <SelectValue placeholder="지역을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region.code} value={region.code}>
                    {region.code} - {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.regionCode && (
              <p className="text-sm text-destructive mt-1">
                {errors.regionCode.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phoneCode">대표자 폰번호 뒷자리 *</Label>
            <Input
              id="phoneCode"
              type="text"
              placeholder="4213"
              maxLength={4}
              {...register("phoneCode")}
              disabled={isEditMode}
            />
            {errors.phoneCode && (
              <p className="text-sm text-destructive mt-1">
                {errors.phoneCode.message}
              </p>
            )}
          </div>
        </div>

        {generatedCode && (
          <div className="mt-4 p-4 bg-muted rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">생성된 센터코드</p>
                <p className="text-2xl font-mono font-bold">{generatedCode}</p>
              </div>
              {codeAvailable !== null && (
                <div>
                  {codeAvailable ? (
                    <span className="text-green-600 font-semibold">
                      ✓ 사용 가능
                    </span>
                  ) : (
                    <span className="text-red-600 font-semibold">
                      ✗ 이미 사용 중
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Basic Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">센터명 *</Label>
            <Input id="name" type="text" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="representative">대표자 이름 *</Label>
            <Input
              id="representative"
              type="text"
              {...register("representative")}
            />
            {errors.representative && (
              <p className="text-sm text-destructive mt-1">
                {errors.representative.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="representativePhone">대표자 연락처 *</Label>
            <Input
              id="representativePhone"
              type="text"
              placeholder="010-1234-5678"
              {...register("representativePhone")}
            />
            {errors.representativePhone && (
              <p className="text-sm text-destructive mt-1">
                {errors.representativePhone.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="address">주소 *</Label>
            <Input id="address" type="text" {...register("address")} />
            {errors.address && (
              <p className="text-sm text-destructive mt-1">
                {errors.address.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="addressDetail">상세주소</Label>
            <Input
              id="addressDetail"
              type="text"
              {...register("addressDetail")}
            />
          </div>

          <div>
            <Label htmlFor="businessNo">사업자등록번호</Label>
            <Input
              id="businessNo"
              type="text"
              placeholder="123-45-67890"
              {...register("businessNo")}
            />
            {errors.businessNo && (
              <p className="text-sm text-destructive mt-1">
                {errors.businessNo.message}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* 로그인 계정 (create 모드에서만) */}
      {!isEditMode && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-1">센터 로그인 계정</h3>
          <p className="text-sm text-muted-foreground mb-4">
            이 센터에서 사용할 로그인 아이디와 비밀번호를 입력하세요. 첫 로그인 시 비밀번호 변경이 필요합니다.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adminUsername">아이디 *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="adminUsername"
                  type="text"
                  placeholder="3자 이상"
                  {...register("adminUsername")}
                  className="flex-1"
                />
                {checkingUsername && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              {usernameAvailable === false && (
                <p className="text-sm text-destructive mt-1">이미 사용 중인 아이디입니다</p>
              )}
              {errors.adminUsername && (
                <p className="text-sm text-destructive mt-1">{errors.adminUsername.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="adminPassword">비밀번호 *</Label>
              <div className="flex gap-2">
                <Input
                  id="adminPassword"
                  type="text"
                  placeholder="8자 이상"
                  {...register("adminPassword")}
                  className="flex-1 font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue("adminPassword", generateTemporaryPassword())}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  자동 생성
                </Button>
              </div>
              {errors.adminPassword && (
                <p className="text-sm text-destructive mt-1">{errors.adminPassword.message}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || (!!generatedCode && !codeAvailable)}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? "수정" : "생성"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
