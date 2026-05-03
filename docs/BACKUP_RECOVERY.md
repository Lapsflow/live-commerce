# 슈퍼무진 라이브커머스 백업/복구 절차

> 최종 업데이트: 2026-05-01

---

## 1. 데이터베이스 백업

### 1-1. Neon 자동 백업 (PITR)

슈퍼무진은 **Neon PostgreSQL**을 사용하며, Neon Pro 플랜에서 자동 PITR(Point-in-Time Recovery)을 지원합니다.

**자동 백업 특성:**
- 지속적인 WAL 아카이빙 (실시간)
- 최대 7일 이전까지 복구 가능 (Pro 플랜)
- 특정 시점으로 정확한 복구 가능

**PITR 복구 방법:**
1. [Neon 콘솔](https://console.neon.tech) 접속
2. 프로젝트 선택 → "Branches" 탭
3. "Create Branch" 클릭
4. "From" 옵션에서 "Point in Time" 선택
5. 복구 시점 (날짜/시간) 지정
6. 새 브랜치 생성 → 데이터 확인
7. 확인 후 메인 브랜치에 반영 (또는 연결 URL 교체)

**주의사항:**
- PITR은 새 브랜치를 생성합니다 (기존 데이터 덮어쓰지 않음)
- 복구 브랜치의 CONNECTION_STRING을 Vercel에 설정하면 즉시 적용
- 원본 브랜치는 보존됩니다

### 1-2. 수동 데이터 백업

긴급 작업 전 수동 백업이 필요할 경우:

```bash
# 전체 스키마 + 데이터 덤프
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# 특정 테이블만
pg_dump "$DATABASE_URL" -t "User" -t "Order" -t "Product" > backup_critical_tables.sql

# 데이터만 (스키마 제외)
pg_dump "$DATABASE_URL" --data-only > backup_data_only.sql
```

**기존 백업 스크립트:**
- `scripts/backup-before-admin-removal.ts` — ADMIN 제거 전 백업 스크립트 (참고용)

### 1-3. 복구 방법

```bash
# 전체 복구 (주의: 기존 데이터 덮어쓰기)
psql "$DATABASE_URL" < backup_20260501_120000.sql

# Prisma 스키마 재동기화
npx prisma db push
```

---

## 2. AuditLog 기반 데이터 복구

시스템의 모든 변경사항은 AuditLog에 기록됩니다.

### 2-1. AuditLog 확인

**UI에서:**
1. 전체관리자 로그인
2. "변경 이력" 메뉴
3. 날짜/액션/엔티티 필터로 검색
4. 변경 전/후 데이터 비교 (diff 뷰)

**API에서:**
```bash
# 최근 변경 이력 조회
curl -H "Cookie: ..." "https://www.supermujin.ai/api/admin/audit-log?pageSize=50"

# 특정 엔티티 변경 이력
curl -H "Cookie: ..." "https://www.supermujin.ai/api/admin/audit-log?entityType=Product&pageSize=50"
```

### 2-2. AuditLog를 이용한 수동 복구

1. AuditLog에서 변경 전 데이터(before) 확인
2. 해당 엔티티의 현재 데이터 조회
3. before 데이터를 참고하여 수동 복원

**기록되는 액션:**
CREATE, UPDATE, DELETE, SOFT_DELETE, RESTORE, LOGIN, LOGIN_FAILED,
ROLE_CHANGED, PERMISSION_DENIED, EXPORT, IMPORT, PASSWORD_CHANGED, STATUS_CHANGED

---

## 3. 외부 API 장애 시 폴백 흐름

### 3-1. 알림 서비스 (Solapi)

| 상황 | 동작 |
|------|------|
| Solapi 키 미설정 | Mock 모드: 로그만 기록 |
| 카카오 알림톡 실패 | LMS 문자로 자동 폴백 |
| LMS도 실패 | 관리자에게 긴급 알림 (ADMIN_ALERT_PHONE) |
| 전체 장애 | NotificationLog에 에러 기록, 수동 연락 필요 |

**환경변수:** `NOTIFICATION_PROVIDER=mock|solapi`

### 3-2. 세금계산서 (PopBill/Barobill)

| 상황 | 동작 |
|------|------|
| PopBill 키 미설정 | Mock 모드: DB에만 기록 |
| PopBill API 장애 | Barobill 백업 (TAX_INVOICE_PROVIDER=barobill) |
| 전체 장애 | 에러 반환, 수동 발행 필요 |

**환경변수:** `TAX_INVOICE_PROVIDER=mock|popbill|barobill`

### 3-3. 가상계좌 (Toss Payments)

| 상황 | 동작 |
|------|------|
| Toss 키 미설정 | Mock 모드: 가짜 계좌번호 반환 |
| Toss API 장애 | 에러 반환, 재시도 가능 |
| 웹훅 실패 | 수동 입금 확인 필요 |

**환경변수:** `TOSS_SECRET_KEY`

### 3-4. ONEWMS (재고/배송)

| 상황 | 동작 |
|------|------|
| API 타임아웃 | Vercel 함수 10초 제한 → 배치 모드 사용 |
| 인증 실패 | 키 만료 확인 (2030-01-01까지 유효) |
| 재고 동기화 실패 | 대시보드에 충돌 알림, 수동 재시도 버튼 |
| 전체 장애 | 로컬 재고 데이터 유지, 수동 관리 전환 |

### 3-5. Naver Shopping (시세 조회)

| 상황 | 동작 |
|------|------|
| API 호출 제한 | Redis 캐시 활용 (설정 시) |
| 키 만료 | 시세 비교 표시 안 됨, 바코드 기본 기능 정상 |

---

## 4. Vercel 배포 복구

### 4-1. 이전 배포로 롤백

1. [Vercel 대시보드](https://vercel.com) 접속
2. 프로젝트 선택 → "Deployments" 탭
3. 정상 동작했던 배포 찾기
4. "..." 메뉴 → "Promote to Production" 클릭
5. 즉시 이전 버전으로 롤백

### 4-2. Git 기반 롤백

```bash
# 이전 커밋으로 되돌리기
git revert HEAD
git push origin main

# 또는 특정 커밋으로
git revert <commit-hash>
git push origin main
```

**주의:** `git reset --hard`는 사용하지 마세요. `git revert`로 안전하게 롤백.

### 4-3. 환경변수 문제

```bash
# Vercel 환경변수 확인
npx vercel env ls

# 환경변수 추가
npx vercel env add VARIABLE_NAME

# 환경변수 삭제
npx vercel env rm VARIABLE_NAME
```

---

## 5. Cron Job 관리

현재 6개의 Cron Job이 등록되어 있습니다.

| Cron | 스케줄 | 설명 |
|------|--------|------|
| stock-sync | 매일 02:00 | ONEWMS 재고 동기화 |
| delivery-sync | 매일 04:00 | 배송 상태 동기화 |
| warehouse-sync | 매일 00:00 | 창고 데이터 동기화 |
| order-auto-cancel | 매일 06:00 | 미결제 주문 자동 취소 |
| broadcast-reminder | 매일 22:00 | 방송 당일 리마인더 |
| broadcast-1h-reminder | 매시 정각 | 방송 1시간 전 리마인더 |

**Cron 장애 확인:**
- Vercel 대시보드 → Functions → Cron Logs
- `CRON_SECRET` 헤더 불일치 시 401 반환

**Cron 수동 실행:**
```bash
curl -X POST "https://www.supermujin.ai/api/cron/stock-sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 6. 비상 연락처 + 절차

### 비상 상황 대응 순서

1. **서비스 접속 불가**
   - Vercel 상태 확인: https://www.vercel-status.com
   - Vercel 대시보드에서 최근 배포 확인
   - 필요 시 이전 배포로 롤백

2. **DB 접속 불가**
   - Neon 상태 확인: https://neonstatus.com
   - Neon 콘솔에서 브랜치 상태 확인
   - 필요 시 PITR로 새 브랜치 생성

3. **데이터 유실 의심**
   - AuditLog에서 최근 변경 확인
   - Neon PITR로 특정 시점 복구
   - 영향 범위 확인 후 사용자 안내

4. **외부 API 장애**
   - 해당 서비스 상태 페이지 확인
   - Mock 모드로 전환 (환경변수 변경)
   - 서비스 복구 후 원복

### 연락처

| 대상 | 연락처 | 용도 |
|------|--------|------|
| 전체관리자 | (기재 필요) | 시스템 전반 |
| Neon Support | console.neon.tech | DB 장애 |
| Vercel Support | vercel.com/help | 배포 장애 |
| ONEWMS | (API 제공처) | 재고/배송 연동 |
| Solapi | solapi.com | 알림 발송 |
| PopBill | popbill.com | 세금계산서 |
| Toss Payments | developers.tosspayments.com | 결제 |

---

_작성: 2026-05-01_
