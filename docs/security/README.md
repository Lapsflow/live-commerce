# 보안 문서 (Security Documentation)

> Live Commerce Platform 보안 관련 문서 모음

---

## 📚 문서 목록

### 1. [보안 감사 보고서 (Security Audit Report)](./security-audit.md)
- **목적**: 전체 시스템 보안 상태 평가 및 취약점 식별
- **대상**: Phase 1-5 구현 완료 후 전체 시스템
- **주요 내용**:
  - 종합 보안 점수: 71/100 (보통)
  - 치명적 취약점: Rate Limiting 미구현, CSRF 보호 부재
  - 중요 취약점: XSS 방어 미흡, 환경변수 노출 위험
  - 개선 로드맵 (Week 1-4)

---

### 2. [보안 모범 사례 (Security Best Practices)](./security-best-practices.md)
- **목적**: 개발 및 운영 시 준수해야 할 보안 가이드라인
- **주요 내용**:
  - 인증 및 인가 (비밀번호, 세션, RBAC)
  - 데이터 보호 (환경변수, 로깅, 데이터베이스)
  - API 보안 (Rate Limiting, CSRF, Input Validation)
  - 프론트엔드 보안 (XSS, CSP, Secure Headers)
  - 인프라 보안 (HTTPS, Secrets, Dependencies)
  - 모니터링 및 감사

---

## 🔴 즉시 조치 필요 (Critical)

### 1. Rate Limiting 구현
**파일**: `lib/rateLimit.ts` (생성 완료)
**적용 대상**:
- `/api/auth/[...nextauth]` - 로그인 시도 (5회/5분)
- `/api/*` - 일반 API (100회/분)
- `/api/proposals/cart` - 장바구니 (20회/분)
- `/api/ai/analyze` - AI 분석 (10회/시간)

**구현 방법**:
```typescript
import { checkRateLimit, loginRateLimit, getClientIp } from "@/lib/rateLimit";

// API route에서 사용
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success, reset } = await checkRateLimit(ip, loginRateLimit);

  if (!success) {
    return rateLimitExceededResponse(reset);
  }

  // 정상 처리...
}
```

**설치 필요**:
```bash
npm install @upstash/ratelimit
```

---

### 2. CSRF 보호 추가
**옵션 1**: Next.js 내장 보호 (권장)
```typescript
// next.config.ts
export default {
  experimental: {
    csrfProtection: true, // Next.js 15+
  },
};
```

**옵션 2**: CSRF 라이브러리
```bash
npm install csrf
```

---

## 🟡 우선 순위 높음 (Important)

### 3. XSS 방어 강화
**설치**:
```bash
npm install isomorphic-dompurify
```

**사용 예시**:
```typescript
import DOMPurify from "isomorphic-dompurify";

const sanitized = DOMPurify.sanitize(userInput);
return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
```

---

### 4. 환경변수 검증
**스크립트**: `scripts/security/validate-env.ts` (생성 완료)
**실행**:
```bash
# 배포 전 필수 실행
npx tsx scripts/security/validate-env.ts
```

**package.json에 추가**:
```json
{
  "scripts": {
    "validate:env": "tsx scripts/security/validate-env.ts",
    "prebuild": "npm run validate:env"
  }
}
```

---

## 🛡️ 보안 체크리스트

### 배포 전 필수 확인

#### 환경 설정
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] Production 환경변수가 Vercel에 설정되어 있는가?
- [ ] `AUTH_SECRET`이 32자 이상 랜덤 문자열인가?
- [ ] `CRON_SECRET`이 32자 이상 랜덤 문자열인가?

#### API 보안
- [ ] Rate limiting이 모든 public API에 적용되어 있는가?
- [ ] CSRF 보호가 활성화되어 있는가?
- [ ] Input validation (Zod)이 모든 API에 적용되어 있는가?

#### 프론트엔드 보안
- [ ] Security headers가 설정되어 있는가?
- [ ] XSS 방어 (DOMPurify)가 적용되어 있는가?
- [ ] 민감 정보 로깅이 제거되었는가?

#### 인프라 보안
- [ ] HTTPS가 강제되는가? (Vercel 자동)
- [ ] `npm audit`에서 High/Critical 취약점이 없는가?
- [ ] Password policy가 구현되어 있는가?

---

## 📊 보안 개선 로드맵

### Week 1 (즉시)
- [x] 보안 감사 보고서 작성
- [x] Rate limiting 라이브러리 준비
- [x] 환경변수 검증 스크립트 작성
- [ ] Rate limiting 실제 적용 (각 API route)
- [ ] CSRF 보호 활성화

### Week 2
- [ ] XSS 방어 강화 (DOMPurify 적용)
- [ ] 민감 정보 로깅 제거 (lib/auth.ts console.log)
- [ ] CSP 헤더 검증 및 최적화

### Week 3-4
- [ ] Session 보안 강화 (Refresh token)
- [ ] Password policy 구현
- [ ] DEV_AUTH_BYPASS 제거 또는 IP whitelist 추가

---

## 🔧 유용한 명령어

### 보안 취약점 스캔
```bash
# npm 패키지 취약점 스캔
npm audit

# 자동 수정 (주의: 버전 변경될 수 있음)
npm audit fix

# High/Critical만 수정
npm audit fix --audit-level=high
```

### 환경변수 검증
```bash
# 전체 검증
npx tsx scripts/security/validate-env.ts

# Production 환경 시뮬레이션
NODE_ENV=production npx tsx scripts/security/validate-env.ts
```

### Security Headers 테스트
```bash
# 개발 서버 실행
npm run dev

# SecurityHeaders.com에서 테스트
# https://securityheaders.com/?q=http://localhost:3000

# 또는 curl로 확인
curl -I http://localhost:3000 | grep -E "(X-Frame-Options|X-Content-Type|Strict-Transport)"
```

---

## 📚 참고 자료

### 공식 문서
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
- [Vercel Security](https://vercel.com/docs/security)

### 보안 표준
- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE Top 25](https://cwe.mitre.org/top25/)

### 도구 및 리소스
- [SecurityHeaders.com](https://securityheaders.com/) - Security headers 테스트
- [Snyk](https://snyk.io/) - Dependency 취약점 스캔
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - npm 패키지 취약점 스캔

---

## 📞 보안 이슈 보고

보안 취약점을 발견하셨나요?

**즉시 보고**: security@your-company.com

**보고 시 포함 사항**:
- 취약점 설명
- 재현 단계
- 영향 범위
- 제안 해결 방법 (선택사항)

**보안 이슈는 GitHub Issues를 사용하지 마세요** - 공개 노출 위험이 있습니다.

---

**마지막 업데이트**: 2026-04-14
**담당자**: Security Team
