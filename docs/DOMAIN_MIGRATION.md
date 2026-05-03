# 도메인 변경 가이드: supermujin.ai → www.supermujin.ai

> 작성일: 2026-05-03

## 변경 개요

| 항목 | Before | After |
|------|--------|-------|
| 기본 도메인 | supermujin.ai | **www.supermujin.ai** |
| 리다이렉트 | 없음 | supermujin.ai → www.supermujin.ai (301) |

**301 리다이렉트**: supermujin.ai로 접속하면 자동으로 www.supermujin.ai로 이동됩니다.
기존 북마크/링크는 모두 정상 작동합니다.

---

## 1. Vercel 도메인 설정 (대표 처리)

### 1-1. Vercel 대시보드 접속
1. https://vercel.com/dashboard 로그인
2. `live-commerce` 프로젝트 선택
3. **Settings** → **Domains** 클릭

### 1-2. www 도메인 추가
1. 입력란에 `www.supermujin.ai` 입력
2. **Add** 클릭
3. 추가 후 `www.supermujin.ai` 옆 **...** → **Set as Primary** 클릭

### 1-3. 루트 도메인 리다이렉트 확인
- `supermujin.ai` 가 목록에 있으면 → **Redirect to www.supermujin.ai** 로 표시되는지 확인
- 표시 안 되면 → `supermujin.ai` 옆 **...** → **Edit** → **Redirect to www.supermujin.ai** 선택

### 1-4. SSL 인증서
- Vercel이 자동 발급 (보통 5분 이내)
- **Status** 가 `Valid Configuration` 으로 바뀔 때까지 대기

---

## 2. DNS 설정 (대표 처리 — whois.co.kr)

### 현재 DNS (변경 불필요할 수 있음)
| 타입 | 호스트 | 값 | 비고 |
|------|--------|------|------|
| A | @ (루트) | 76.76.21.21 | Vercel IP |
| CNAME | www | cname.vercel-dns.com | Vercel CNAME |

### 확인사항
- **www CNAME** 이 `cname.vercel-dns.com` 으로 설정되어 있는지 확인
- **이미 설정되어 있다면 DNS 변경 불필요**
- 설정 안 되어 있다면 위 표대로 추가

---

## 3. 환경변수 변경 (대표 처리 — Vercel 대시보드)

### 3-1. Vercel 환경변수 업데이트
1. Vercel 대시보드 → `live-commerce` → **Settings** → **Environment Variables**
2. 다음 변수 수정:

| 변수명 | Before | After |
|--------|--------|-------|
| AUTH_URL | `https://supermujin.ai` | `https://www.supermujin.ai` |

3. **Save** 클릭
4. **Deployments** 탭 → 최신 배포 → **...** → **Redeploy** 클릭 (환경변수 적용)

---

## 4. 외부 API URL 변경 체크리스트

아래 서비스에서 등록된 콜백/웹훅 URL을 변경해야 합니다.

### 4-1. 즉시 변경 필요 (키 발급 시)

| 서비스 | 변경 대상 | Before | After |
|--------|----------|--------|-------|
| Toss Payments | 웹훅 URL | `supermujin.ai/api/webhooks/toss/virtual-account` | `www.supermujin.ai/api/webhooks/toss/virtual-account` |
| PopBill | 웹훅 URL | `supermujin.ai/api/webhooks/popbill` | `www.supermujin.ai/api/webhooks/popbill` |

### 4-2. 영향 없음 (서버→서버 호출)

| 서비스 | 이유 |
|--------|------|
| ONEWMS API | 서버에서 직접 호출 (도메인 무관) |
| Naver Shopping API | 서버에서 직접 호출 (도메인 무관) |
| Google Gemini | 서버에서 직접 호출 (도메인 무관) |
| Solapi | 서버에서 직접 호출 (웹훅 미사용) |

---

## 5. 검증 방법

### 5-1. 리다이렉트 확인 (터미널)
```bash
curl -I https://supermujin.ai
```
**기대 결과:**
```
HTTP/2 301
location: https://www.supermujin.ai/
```

### 5-2. 정상 접속 확인
```bash
curl -I https://www.supermujin.ai
```
**기대 결과:**
```
HTTP/2 200
```

### 5-3. 브라우저 확인
1. 브라우저에서 `supermujin.ai` 입력
2. 자동으로 `www.supermujin.ai` 로 이동되는지 확인
3. 로그인 정상 동작 확인
4. 각 메뉴 페이지 접근 확인

---

## 6. 작업 순서 요약

| 순서 | 작업 | 담당 | 소요 |
|------|------|------|------|
| 1 | 코드 배포 (middleware 리다이렉트) | 개발 (완료) | 자동 |
| 2 | Vercel 도메인 설정 (위 섹션 1) | **대표** | 5분 |
| 3 | DNS 확인 (위 섹션 2) | **대표** | 2분 |
| 4 | SSL 인증서 발급 대기 | 자동 | 5분 |
| 5 | 환경변수 변경 + Redeploy (위 섹션 3) | **대표** | 5분 |
| 6 | 검증 (위 섹션 5) | **대표/개발** | 5분 |
| 7 | 외부 API URL 변경 (위 섹션 4) | **대표** | 키 발급 시 |

---

## 7. 롤백 방법

문제 발생 시:
1. Vercel 대시보드 → Domains → `supermujin.ai` 를 Primary로 변경
2. AUTH_URL 환경변수를 `https://supermujin.ai` 로 복원
3. Redeploy

middleware의 리다이렉트는 `host === "supermujin.ai"` 조건이므로, www가 Primary가 아니면 리다이렉트되지 않아 안전합니다.
