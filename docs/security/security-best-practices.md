# 보안 모범 사례 (Security Best Practices)

> Live Commerce Platform 개발 및 운영 보안 가이드

---

## 📋 목차

1. [인증 및 인가](#인증-및-인가)
2. [데이터 보호](#데이터-보호)
3. [API 보안](#api-보안)
4. [프론트엔드 보안](#프론트엔드-보안)
5. [인프라 보안](#인프라-보안)
6. [모니터링 및 감사](#모니터링-및-감사)
7. [보안 체크리스트](#보안-체크리스트)

---

## 🔐 인증 및 인가

### 1. 비밀번호 관리

**✅ DO**:
```typescript
// bcrypt로 해싱 (salt rounds 10 이상)
const hash = await bcrypt.hash(password, 10);

// 비밀번호 정책 강제
const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};
```

**❌ DON'T**:
```typescript
// 평문 저장 (절대 금지)
user.password = rawPassword;

// 약한 해싱 알고리즘
const hash = md5(password); // ❌
const hash = sha1(password); // ❌
```

---

### 2. Session 관리

**✅ DO**:
```typescript
// JWT with reasonable expiry
session: {
  strategy: "jwt",
  maxAge: 4 * 60 * 60, // 4시간
}

// Refresh token 구현
refreshToken: {
  maxAge: 7 * 24 * 60 * 60, // 7일
  rotation: true,
}
```

**❌ DON'T**:
```typescript
// 무제한 세션
maxAge: 365 * 24 * 60 * 60, // 1년 ❌

// 토큰을 localStorage에 저장 (XSS 위험)
localStorage.setItem("token", jwt); // ❌
```

---

### 3. Role-Based Access Control

**✅ DO**:
```typescript
// API에서 role 검증
const allowedRoles = ["MASTER", "ADMIN"];
if (!allowedRoles.includes(session.user.role)) {
  return errors.forbidden();
}

// Resource ownership 검증
if (order.userId !== session.user.id && session.user.role !== "MASTER") {
  return errors.forbidden();
}
```

---

## 🛡️ 데이터 보호

### 1. 환경변수 관리

**✅ DO**:
```bash
# .env (Never commit to git)
DATABASE_URL="postgresql://..."
AUTH_SECRET="random-32-char-string"

# .env.example (Template only, safe to commit)
DATABASE_URL="postgresql://user:pass@host:5432/db"
AUTH_SECRET="your-secret-here"
```

**Validation**:
```typescript
// scripts/security/validate-env.ts
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error("AUTH_SECRET must be at least 32 characters");
}
```

**❌ DON'T**:
```typescript
// 클라이언트에서 접근 가능하게 노출
// NEXT_PUBLIC_ prefix는 신중하게 사용
const apiKey = process.env.NEXT_PUBLIC_SECRET_KEY; // ❌
```

---

### 2. 민감 정보 로깅

**✅ DO**:
```typescript
// 비밀번호는 절대 로깅 금지
securityLogger.authFailed({ reason: "invalid_password", email });

// Production 환경에서 디버그 로그 제거
if (process.env.NODE_ENV === "development") {
  console.log("[DEBUG]", data);
}
```

**❌ DON'T**:
```typescript
// 민감 정보 로깅
console.log("Password:", password); // ❌
console.log("Token:", jwt); // ❌
console.log("Hash:", passwordHash.substring(0, 20)); // ❌
```

---

### 3. 데이터베이스 보안

**✅ DO**:
```typescript
// Prisma ORM (Parameterized queries)
await prisma.user.findUnique({
  where: { email }, // Safe from SQL injection
});

// Row-level security (RLS) 고려
// Neon Database에서 지원하는 경우 활성화
```

**❌ DON'T**:
```typescript
// Raw SQL with string concatenation
const query = `SELECT * FROM users WHERE email = '${email}'`; // ❌
```

---

## 🔒 API 보안

### 1. Rate Limiting

**✅ DO**:
```typescript
// lib/rateLimit.ts
import { checkRateLimit, loginRateLimit } from "@/lib/rateLimit";

// Login endpoint
const { success } = await checkRateLimit(ip, loginRateLimit);
if (!success) {
  return rateLimitExceededResponse(reset);
}
```

**Rate Limit 정책**:
| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/[...nextauth] | 5 | 5분 |
| /api/* (일반) | 100 | 1분 |
| /api/proposals/cart | 20 | 1분 |
| /api/ai/analyze | 10 | 1시간 |

---

### 2. CSRF 보호

**✅ DO**:
```typescript
// middleware.ts
import { csrfProtection } from "@/lib/csrf";

export async function middleware(req: NextRequest) {
  // State-changing requests (POST, PUT, DELETE)
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    const valid = await csrfProtection.verify(req);
    if (!valid) {
      return new Response("CSRF token invalid", { status: 403 });
    }
  }
}
```

**Alternative**: Next.js 15+ 내장 CSRF 보호 활성화
```typescript
// next.config.ts
export default {
  experimental: {
    csrfProtection: true,
  },
};
```

---

### 3. Input Validation

**✅ DO**:
```typescript
// Zod schema로 검증
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["SELLER", "ADMIN", "MASTER"]),
});

const body = createUserSchema.parse(await req.json());
```

**❌ DON'T**:
```typescript
// 검증 없이 사용
const { email, password } = await req.json(); // ❌
```

---

## 🌐 프론트엔드 보안

### 1. XSS 방어

**✅ DO**:
```typescript
// DOMPurify로 HTML sanitization
import DOMPurify from "isomorphic-dompurify";

const sanitized = DOMPurify.sanitize(userInput);
return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;

// React 기본 이스케이프 사용
return <p>{userInput}</p>; // Automatically escaped
```

**❌ DON'T**:
```typescript
// Raw HTML 삽입
return <div dangerouslySetInnerHTML={{ __html: userInput }} />; // ❌
```

---

### 2. Content Security Policy

**✅ DO**:
```typescript
// next.config.ts
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.vercel-insights.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.anthropic.com https://*.upstash.io;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`;

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
  },
];
```

---

### 3. Secure Headers

**✅ DO**:
```typescript
// next.config.ts
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

export default {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## 🏗️ 인프라 보안

### 1. HTTPS 강제

**✅ Vercel 배포 시 자동 적용**:
- 모든 HTTP 요청은 HTTPS로 리다이렉트
- Let's Encrypt SSL 인증서 자동 갱신

---

### 2. Secrets 관리

**✅ DO**:
```bash
# Vercel Environment Variables
# Production 환경에서만 사용되는 secret은 "Production" 환경에만 추가

# GitHub Actions Secrets
# Repository Settings > Secrets and variables > Actions
```

**❌ DON'T**:
```typescript
// 코드에 하드코딩
const apiKey = "sk-ant-api03-..."; // ❌

// .env 파일을 git에 커밋
git add .env // ❌
```

---

### 3. Dependency 관리

**✅ DO**:
```bash
# 정기적으로 취약점 스캔
npm audit

# 자동 업데이트 (Dependabot)
# .github/dependabot.yml 설정

# 신뢰할 수 있는 패키지만 사용
npm install --save-exact <package>
```

---

## 📊 모니터링 및 감사

### 1. Security Logging

**✅ DO**:
```typescript
// lib/logger.ts
export const securityLogger = {
  authFailed: (details: { reason: string; email?: string }) => {
    console.log(JSON.stringify({
      type: "AUTH_FAILED",
      timestamp: new Date().toISOString(),
      ...details,
    }));
  },

  suspiciousActivity: (details: { action: string; userId?: string; ip?: string }) => {
    console.log(JSON.stringify({
      type: "SUSPICIOUS_ACTIVITY",
      timestamp: new Date().toISOString(),
      ...details,
    }));
  },
};
```

---

### 2. 보안 이벤트 모니터링

**감시 대상**:
- 연속된 로그인 실패 (5회 이상)
- Rate limit 초과 패턴
- 비정상적인 API 호출 패턴
- 권한 외 리소스 접근 시도

---

## ✅ 보안 체크리스트

### 배포 전 필수 확인 사항

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] Production 환경변수가 Vercel에 설정되어 있는가?
- [ ] `AUTH_SECRET`이 32자 이상 랜덤 문자열인가?
- [ ] Rate limiting이 모든 public API에 적용되어 있는가?
- [ ] CSRF 보호가 활성화되어 있는가?
- [ ] Security headers가 설정되어 있는가?
- [ ] 민감 정보 로깅이 제거되었는가?
- [ ] `npm audit`에서 High/Critical 취약점이 없는가?
- [ ] HTTPS가 강제되는가? (Vercel 자동)
- [ ] Password policy가 구현되어 있는가?

### 정기 점검 사항 (월 1회)

- [ ] Dependency 취약점 스캔 및 업데이트
- [ ] Security logs 검토
- [ ] Rate limit 정책 효과 분석
- [ ] API key rotation (분기별)
- [ ] 접근 권한 검토 (사용자 role)

---

## 📚 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Vercel Security](https://vercel.com/docs/security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**마지막 업데이트**: 2026-04-14
**담당자**: Security Team
