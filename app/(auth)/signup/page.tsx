"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

// 채널 옵션 (PDF 스펙)
const CHANNEL_OPTIONS = ["그립", "클릭메이트", "유튜브", "틱톡", "개인플랫폼", "기타"];

// 매출 옵션 (PDF 스펙)
const SALES_OPTIONS = [
  "100만원 이하",
  "100~500만원",
  "500~1000만원",
  "1000~3000만원",
  "3000만~1억",
  "1억 이상",
];

// 판매 카테고리 옵션 (PDF p2 스펙)
const CATEGORY_OPTIONS = ["식품", "건기식", "의류", "잡화", "유아", "애견", "기타"];

// 활동 지역 옵션 (PDF p2 센터코드 기준)
const REGION_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주",
  "울산", "세종", "강원", "충북", "충남", "전북", "전남",
  "경북", "경남", "제주",
];

// 방송 가능 시간대
const TIMESLOT_OPTIONS = [
  "오전 (06:00~12:00)",
  "오후 (12:00~18:00)",
  "저녁 (18:00~22:00)",
  "심야 (22:00~06:00)",
];

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [userId, setUserId] = useState<string>("");

  // Step 1: 기본 정보
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Step 2: 추가 정보
  const [channels, setChannels] = useState<string[]>([]);
  const [avgSales, setAvgSales] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const router = useRouter();

  // 실시간 유효성 검증 상태
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [emailValid, setEmailValid] = useState<"idle" | "valid" | "invalid">("idle");
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 아이디 중복 확인 (debounce 500ms)
  const checkUsername = useCallback((value: string) => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (value.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
        const data = await res.json();
        setUsernameStatus(data.data?.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
  }, []);

  // 이메일 형식 검증
  const validateEmail = useCallback((value: string) => {
    if (!value) {
      setEmailValid("idle");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailValid(emailRegex.test(value) ? "valid" : "invalid");
  }, []);

  // 휴대폰번호 자동 포맷팅 (010-1234-1234)
  const formatPhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  // Step 1: 가입하기
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    const phoneDigits = phone.replace(/-/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("휴대폰번호를 올바르게 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          name,
          phone: phoneDigits,
          email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "회원가입 실패");
        setLoading(false);
      } else {
        setUserId(data.data?.id || "");
        setStep(2);
        setLoading(false);
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  // Step 2: 추가 정보 저장
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await fetch("/api/auth/signup/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          channels,
          avgSales: avgSales || undefined,
          categories: categories.length > 0 ? categories : undefined,
          regions: regions.length > 0 ? regions : undefined,
          timeSlots: timeSlots.length > 0 ? timeSlots : undefined,
        }),
      });
    } catch {
      // 실패해도 가입은 완료됨
    }
    setSavingProfile(false);
    router.push("/login");
  };

  const handleSkip = () => {
    router.push("/login");
  };

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleItem = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grey-50">
      <Card className="w-full max-w-md p-8 shadow-md">
        {/* 브랜딩 */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-grey-900">라이브커머스</h1>
          <h2 className="text-lg font-semibold text-blue-600">운영관리 시스템</h2>
          <p className="text-xs text-grey-400 mt-1">Live Commerce Management System</p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center my-5">
          <div className="flex items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 1
                  ? "bg-blue-600 text-white"
                  : "bg-grey-200 text-grey-500"
              }`}
            >
              {step > 1 ? <Check className="w-4 h-4" /> : "1"}
            </div>
            <span className="text-sm font-medium text-grey-700">기본 정보</span>
          </div>
          <div className="w-12 h-px bg-grey-300 mx-3" />
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-grey-700">가입완료</span>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 2
                  ? "bg-blue-600 text-white"
                  : "bg-grey-200 text-grey-500"
              }`}
            >
              2
            </div>
          </div>
        </div>

        {/* Step 1: 기본 정보 */}
        {step === 1 && (
          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                아이디 <span className="text-red">*</span>
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  checkUsername(e.target.value);
                }}
                placeholder="아이디를 입력하세요"
                required
                minLength={3}
                maxLength={50}
              />
              {usernameStatus === "checking" && (
                <p className="text-xs text-grey-400 mt-1">확인 중...</p>
              )}
              {usernameStatus === "available" && (
                <p className="text-xs text-green-600 mt-1">사용 가능한 아이디입니다</p>
              )}
              {usernameStatus === "taken" && (
                <p className="text-xs text-red mt-1">이미 사용 중인 아이디입니다</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                비밀번호 (8자 이상) <span className="text-red">*</span>
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                비밀번호 확인 <span className="text-red">*</span>
              </label>
              <Input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                required
                minLength={8}
              />
              {passwordConfirm && password !== passwordConfirm && (
                <p className="text-xs text-red mt-1">비밀번호가 일치하지 않습니다</p>
              )}
              {passwordConfirm && password === passwordConfirm && (
                <p className="text-xs text-green-600 mt-1">비밀번호가 일치합니다</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                이름 (실명) <span className="text-red">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                휴대폰 번호 (010-0000-0000) <span className="text-red">*</span>
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-1234-1234"
                required
                maxLength={13}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-grey-700 mb-1.5">
                이메일 <span className="text-red">*</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  validateEmail(e.target.value);
                }}
                placeholder="email@example.com"
                required
              />
              {emailValid === "valid" && (
                <p className="text-xs text-green-600 mt-1">올바른 형식입니다</p>
              )}
              {emailValid === "invalid" && (
                <p className="text-xs text-red mt-1">올바르지 않은 이메일 형식입니다</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red bg-red/5 p-3 rounded-lg">{error}</p>
            )}

            <div className="pt-2 space-y-2.5">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "가입 중..." : "가입하기"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/login")}
              >
                돌아가기
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: 가입완료 + 추가 정보 */}
        {step === 2 && (
          <div className="space-y-5">
            {/* 완료 메시지 */}
            <div className="text-center bg-blue-50 rounded-lg p-5">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-grey-900">
                가입 신청이 완료되었습니다!
              </h3>
              <p className="text-sm text-grey-600 mt-1">
                관리자 승인 후 로그인 가능합니다. 추가 정보를 미리 입력해두세요
              </p>
            </div>

            {/* 방송 채널 (복수 선택) */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">
                방송 채널 (복수 선택)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CHANNEL_OPTIONS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleChannel(channel)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      channels.includes(channel)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-grey-700 border-grey-200 hover:border-blue-300"
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            {/* 월 평균 매출 */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">
                월 평균 매출
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SALES_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAvgSales(option)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      avgSales === option
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-grey-700 border-grey-200 hover:border-blue-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* 주요 판매 카테고리 (복수 선택) */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">
                주요 판매 카테고리 (복수 선택)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleItem(cat, setCategories)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      categories.includes(cat)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-grey-700 border-grey-200 hover:border-blue-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 활동 지역 (복수 선택) */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">
                활동 지역 (복수 선택)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {REGION_OPTIONS.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleItem(region, setRegions)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      regions.includes(region)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-grey-700 border-grey-200 hover:border-blue-300"
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* 방송 가능 시간대 (복수 선택) */}
            <div>
              <label className="block text-sm font-medium text-grey-700 mb-2">
                방송 가능 시간대 (복수 선택)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIMESLOT_OPTIONS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleItem(slot, setTimeSlots)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      timeSlots.includes(slot)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-grey-700 border-grey-200 hover:border-blue-300"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* 버튼 */}
            <div className="pt-2 space-y-2.5">
              <Button
                className="w-full"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? "저장 중..." : "저장하고 시작하기"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSkip}
              >
                건너뛰기 →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
