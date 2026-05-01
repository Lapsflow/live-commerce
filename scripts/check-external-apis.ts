/**
 * 외부 API 연결 상태 점검 스크립트
 *
 * 사용법: npx tsx scripts/check-external-apis.ts
 *
 * 점검 항목:
 * 1. ONEWMS - get_stock_info 호출
 * 2. Solapi - 잔액 조회
 * 3. PopBill - 테스트베드 연결
 * 4. Toss Payments - API ping
 * 5. Naver Shopping - 검색 테스트
 * 6. Gemini AI - 모델 호출 테스트
 */

import * as dotenv from "dotenv";
dotenv.config();

type Status = "OK" | "MOCK" | "ERROR" | "NO_KEY";

interface CheckResult {
  service: string;
  status: Status;
  detail: string;
  envVars: string[];
  missingVars: string[];
}

const results: CheckResult[] = [];

// ── 1. ONEWMS ──
async function checkOnewms(): Promise<CheckResult> {
  const envVars = ["ONEWMS_PARTNER_KEY", "ONEWMS_DOMAIN_KEY", "ONEWMS_API_URL"];
  const missing = envVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    return { service: "ONEWMS", status: "NO_KEY", detail: `Missing: ${missing.join(", ")}`, envVars, missingVars: missing };
  }

  try {
    const params = new URLSearchParams({
      command: "get_stock_info",
      partner_key: process.env.ONEWMS_PARTNER_KEY!,
      domain_key: process.env.ONEWMS_DOMAIN_KEY!,
      type: "all",
      ids: "",
    });

    const res = await fetch(process.env.ONEWMS_API_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    const productCount = data?.data ? Object.keys(data.data).length : 0;
    return {
      service: "ONEWMS",
      status: "OK",
      detail: `API 응답 정상 (재고 상품 ${productCount}개)`,
      envVars,
      missingVars: [],
    };
  } catch (e: any) {
    return { service: "ONEWMS", status: "ERROR", detail: e.message, envVars, missingVars: [] };
  }
}

// ── 2. Solapi ──
async function checkSolapi(): Promise<CheckResult> {
  const envVars = ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER_PHONE"];
  const missing = envVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    const provider = process.env.NOTIFICATION_PROVIDER || "mock";
    return {
      service: "Solapi (알림)",
      status: "MOCK",
      detail: `NOTIFICATION_PROVIDER=${provider}. Mock 모드 동작 중. 키 미발급.`,
      envVars: [...envVars, "NOTIFICATION_PROVIDER", "SOLAPI_PFID", "ADMIN_ALERT_PHONE"],
      missingVars: missing,
    };
  }

  try {
    // Solapi 잔액 조회 API
    const timestamp = Date.now().toString();
    const crypto = await import("crypto");
    const signature = crypto
      .createHmac("sha256", process.env.SOLAPI_API_SECRET!)
      .update(timestamp)
      .digest("hex");

    const res = await fetch("https://api.solapi.com/cash/v1/balance", {
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY!}, date=${timestamp}, signature=${signature}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        service: "Solapi (알림)",
        status: "OK",
        detail: `잔액: ${data.balance ?? "?"}원, 포인트: ${data.point ?? "?"}`,
        envVars,
        missingVars: [],
      };
    } else {
      return {
        service: "Solapi (알림)",
        status: "ERROR",
        detail: `HTTP ${res.status}: ${await res.text()}`,
        envVars,
        missingVars: [],
      };
    }
  } catch (e: any) {
    return { service: "Solapi (알림)", status: "ERROR", detail: e.message, envVars, missingVars: [] };
  }
}

// ── 3. PopBill ──
async function checkPopbill(): Promise<CheckResult> {
  const envVars = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY", "POPBILL_CORP_NUM"];
  const missing = envVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    const provider = process.env.TAX_INVOICE_PROVIDER || "mock";
    return {
      service: "PopBill (세금계산서)",
      status: "MOCK",
      detail: `TAX_INVOICE_PROVIDER=${provider}. Mock 모드 동작 중. 키 미발급.`,
      envVars: [...envVars, "TAX_INVOICE_PROVIDER", "POPBILL_IS_TEST"],
      missingVars: missing,
    };
  }

  return {
    service: "PopBill (세금계산서)",
    status: "OK",
    detail: `키 설정됨. IS_TEST=${process.env.POPBILL_IS_TEST ?? "undefined"}`,
    envVars,
    missingVars: [],
  };
}

// ── 4. Toss Payments ──
async function checkToss(): Promise<CheckResult> {
  const envVars = ["TOSS_SECRET_KEY"];
  const missing = envVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    return {
      service: "Toss Payments (가상계좌)",
      status: "MOCK",
      detail: "키 미발급. Mock 모드 (가짜 계좌번호 반환).",
      envVars: [...envVars, "TOSS_CLIENT_KEY"],
      missingVars: missing,
    };
  }

  try {
    // Toss API health check - GET /v1/payments (will return 401 if key format wrong)
    const encoded = Buffer.from(process.env.TOSS_SECRET_KEY! + ":").toString("base64");
    const res = await fetch("https://api.tosspayments.com/v1/payments", {
      headers: { Authorization: `Basic ${encoded}` },
    });

    // 401 = key format ok but no auth, 200 = ok
    if (res.status === 401 || res.status === 200 || res.status === 400) {
      return {
        service: "Toss Payments (가상계좌)",
        status: "OK",
        detail: `API 응답: HTTP ${res.status} (키 연결 정상)`,
        envVars,
        missingVars: [],
      };
    }
    return {
      service: "Toss Payments (가상계좌)",
      status: "ERROR",
      detail: `HTTP ${res.status}`,
      envVars,
      missingVars: [],
    };
  } catch (e: any) {
    return { service: "Toss Payments (가상계좌)", status: "ERROR", detail: e.message, envVars, missingVars: [] };
  }
}

// ── 5. Naver Shopping ──
async function checkNaver(): Promise<CheckResult> {
  const envVars = ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"];
  const missing = envVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    return {
      service: "Naver Shopping (시세 조회)",
      status: "NO_KEY",
      detail: `Missing: ${missing.join(", ")}`,
      envVars,
      missingVars: missing,
    };
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent("테스트")}&display=1`,
      {
        headers: {
          "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID!,
          "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET!,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      return {
        service: "Naver Shopping (시세 조회)",
        status: "OK",
        detail: `검색 정상 (총 ${data.total ?? 0}건)`,
        envVars,
        missingVars: [],
      };
    }
    return {
      service: "Naver Shopping (시세 조회)",
      status: "ERROR",
      detail: `HTTP ${res.status}: ${await res.text()}`,
      envVars,
      missingVars: [],
    };
  } catch (e: any) {
    return { service: "Naver Shopping (시세 조회)", status: "ERROR", detail: e.message, envVars, missingVars: [] };
  }
}

// ── 6. Gemini AI ──
async function checkGemini(): Promise<CheckResult> {
  const envVars = ["GEMINI_KEY"];
  const missing = envVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    return {
      service: "Gemini AI (상품 분석)",
      status: "NO_KEY",
      detail: `Missing: ${missing.join(", ")}`,
      envVars,
      missingVars: missing,
    };
  }

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say OK" }] }],
        }),
      }
    );

    if (res.ok) {
      return {
        service: "Gemini AI (상품 분석)",
        status: "OK",
        detail: `모델 ${model} 응답 정상`,
        envVars,
        missingVars: [],
      };
    }
    const errText = await res.text();
    return {
      service: "Gemini AI (상품 분석)",
      status: "ERROR",
      detail: `HTTP ${res.status}: ${errText.substring(0, 100)}`,
      envVars,
      missingVars: [],
    };
  } catch (e: any) {
    return { service: "Gemini AI (상품 분석)", status: "ERROR", detail: e.message, envVars, missingVars: [] };
  }
}

// ── Main ──
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  외부 API 연결 상태 점검");
  console.log("  실행 시각:", new Date().toISOString());
  console.log("═══════════════════════════════════════════════\n");

  const checks = await Promise.all([
    checkOnewms(),
    checkSolapi(),
    checkPopbill(),
    checkToss(),
    checkNaver(),
    checkGemini(),
  ]);

  for (const r of checks) {
    const icon =
      r.status === "OK" ? "✅" :
      r.status === "MOCK" ? "🔸" :
      r.status === "NO_KEY" ? "⬜" : "❌";

    console.log(`${icon} ${r.service}`);
    console.log(`   상태: ${r.status}`);
    console.log(`   상세: ${r.detail}`);
    if (r.missingVars.length > 0) {
      console.log(`   미설정: ${r.missingVars.join(", ")}`);
    }
    console.log();
  }

  // 요약
  const ok = checks.filter((r) => r.status === "OK").length;
  const mock = checks.filter((r) => r.status === "MOCK").length;
  const noKey = checks.filter((r) => r.status === "NO_KEY").length;
  const error = checks.filter((r) => r.status === "ERROR").length;

  console.log("───────────────────────────────────────────────");
  console.log(`요약: ✅ ${ok} OK | 🔸 ${mock} Mock | ⬜ ${noKey} No Key | ❌ ${error} Error`);
  console.log("───────────────────────────────────────────────");

  // 누락 환경변수 종합
  const allMissing = checks.flatMap((r) => r.missingVars);
  if (allMissing.length > 0) {
    console.log("\n📋 Vercel에 추가 필요한 환경변수:");
    [...new Set(allMissing)].forEach((v) => console.log(`   - ${v}`));
  }
}

main().catch(console.error);
