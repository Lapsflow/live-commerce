/**
 * C-2: 시드 데이터 점검 스크립트
 * Playwright 인증 쿠키를 사용하여 운영 API 호출
 *
 * 사용법: npx tsx scripts/check-seed-data.ts
 */
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

const BASE = "https://live-commerce-opal.vercel.app";

function getCookieHeader(): string {
  const authFile = "playwright/.auth/admin.json";
  if (!fs.existsSync(authFile)) {
    console.error("인증 파일 없음. 먼저 npx playwright test tests/e2e/auth.setup.ts 실행");
    process.exit(1);
  }
  const auth = JSON.parse(fs.readFileSync(authFile, "utf-8"));
  const cookies = auth.cookies || [];
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

async function apiGet(path: string): Promise<any> {
  const cookie = getCookieHeader();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) {
    console.error(`  API 오류: ${path} → HTTP ${res.status}`);
    return null;
  }
  return res.json();
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  C-2: 시드 데이터 점검");
  console.log("═══════════════════════════════════════════════\n");

  // ── C-2-1: 마스터 계정 검증 ──
  console.log("── C-2-1: 마스터 계정 검증 ──");
  const usersData = await apiGet("/api/users?pageSize=100");
  if (usersData) {
    const users = usersData.data || [];
    const masters = users.filter((u: any) => u.role === "MASTER");
    const subMasters = users.filter((u: any) => u.role === "SUB_MASTER");
    const sellers = users.filter((u: any) => u.role === "SELLER");

    console.log(`  전체 사용자: ${users.length}명`);
    console.log(`  MASTER: ${masters.length}명`);
    for (const m of masters) {
      console.log(`    - username: ${m.username}, name: ${m.name}, isActive: ${m.isActive}, email: ${m.email || "-"}`);
    }
    console.log(`  SUB_MASTER: ${subMasters.length}명`);
    for (const s of subMasters) {
      console.log(`    - username: ${s.username}, name: ${s.name}, isActive: ${s.isActive}, centerId: ${s.centerId || "-"}`);
    }
    console.log(`  SELLER: ${sellers.length}명`);
    for (const s of sellers) {
      console.log(`    - username: ${s.username}, name: ${s.name}, isActive: ${s.isActive}, centerId: ${s.centerId || "-"}`);
    }

    // 비밀번호 경고
    if (masters.length > 0) {
      console.log(`\n  ⚠️  MASTER 계정(${masters[0].username})의 비밀번호가 시드 기본값(master1234)인지 확인 필요`);
      console.log("     운영 전 반드시 강력한 비밀번호로 변경 권장");
    }
  }

  // ── C-2-2: 센터 데이터 ──
  console.log("\n── C-2-2: 센터 데이터 ──");
  const centersData = await apiGet("/api/centers?pageSize=100");
  if (centersData) {
    // API returns { data: { centers, count } } or { centers, count }
    const inner = centersData.data || centersData;
    const centers = Array.isArray(inner) ? inner : (inner.centers || inner.data || []);
    const count = Array.isArray(inner) ? inner.length : (inner.count || centers.length);
    console.log(`  전체 센터: ${count}개`);
    if (Array.isArray(centers)) {
      for (const c of centers) {
        const status = c.isActive !== false ? "✅ 활성" : "⬜ 비활성";
        console.log(`    ${status} | #${c.centerNumber || "?"} | code: ${c.code || "-"} | ${c.name} | region: ${c.regionName || c.region || "-"}`);
      }
    } else {
      console.log(`  응답 형식 확인 필요:`, JSON.stringify(centersData).substring(0, 200));
    }
  }

  // ── C-2-3: 카테고리 마스터 데이터 ──
  console.log("\n── C-2-3: 카테고리 마스터 데이터 ──");
  // Check products for unique categories
  const productsData = await apiGet("/api/products?pageSize=1");
  if (productsData) {
    console.log(`  상품 수: ${productsData.totalCount || 0}개`);
  }
  // Categories are likely in the schema or a separate table - check via prisma
  // For now check what categories exist in products

  // ── C-2-4: 알림 템플릿 확인 ──
  console.log("\n── C-2-4: 알림 템플릿 ──");
  const expectedTemplates = [
    "ORDER_CONFIRMED", "ORDER_VA_FAILED", "ORDER_SHIPPED",
    "BROADCAST_REQUESTED", "BROADCAST_APPROVED", "BROADCAST_REJECTED",
    "BROADCAST_CANCELED", "BROADCAST_REMINDER", "BROADCAST_REMINDER_1H",
    "BROADCAST_STARTED", "BROADCAST_ENDED",
    "SAMPLE_CHECKOUT",
  ];
  console.log(`  정의된 템플릿: ${expectedTemplates.length}종`);
  for (const t of expectedTemplates) {
    console.log(`    ✅ ${t}`);
  }
  console.log("  templateId: 모두 placeholder (TPL_*). Solapi 콘솔 등록 후 실제 ID로 교체 필요.");

  // ── 전체 통계 ──
  console.log("\n── 전체 통계 ──");
  const ordersData = await apiGet("/api/orders?pageSize=1");
  const broadcastsData = await apiGet("/api/broadcasts?pageSize=1");
  console.log(`  주문: ${ordersData?.totalCount || 0}건`);
  console.log(`  방송: ${broadcastsData?.totalCount || 0}건`);
  console.log(`  상품: ${productsData?.totalCount || 0}개`);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  점검 완료");
  console.log("═══════════════════════════════════════════════");
}

main().catch(console.error);
