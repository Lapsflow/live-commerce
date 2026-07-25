import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── 점검 모드 (MAINTENANCE_MODE=true) ───
  // 화면·일반 API 는 503, 웹훅/cron/auth 는 통과 (데이터 유실 0)
  // dealer-admin-kp 와 동일 방식. 인증/rate-limit 로직보다 반드시 먼저.
  const isKpPayNoti = /^\/api\/kp-pay\/noti(\/|$)/i.test(pathname);
  const isCronApi = pathname.startsWith("/api/cron/");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isApiRoute = pathname.startsWith("/api/");
  if (process.env.MAINTENANCE_MODE === "true" && !isKpPayNoti && !isCronApi && !isAuthApi) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "서비스 점검 중입니다. 잠시 후 다시 이용해주세요." },
        { status: 503, headers: { "Retry-After": "600" } },
      );
    }
    return new NextResponse(
      "<html><head><meta charset='utf-8'><title>서비스 점검 중</title></head>" +
        "<body style='font-family:sans-serif;text-align:center;padding:80px 20px'>" +
        "<h1>서비스 점검 중입니다</h1><p>잠시 후 다시 이용해주세요.</p></body></html>",
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Retry-After": "600",
        },
      },
    );
  }

  // Check if user has auth cookie (existence only, no validation)
  // Note: NextAuth v5 uses encrypted tokens that cannot be decoded with jose.decodeJwt()
  const authCookie = req.cookies.get("authjs.session-token") ||
                     req.cookies.get("__Secure-authjs.session-token");
  const isLoggedIn = !!authCookie;

  // Public routes (로그인 없이 접근 가능)
  const publicRoutes = ["/login", "/signup"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // API routes (인증 체크는 각 API에서 처리)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Public route는 그대로 진행
  if (isPublicRoute) {
    // 이미 로그인된 사용자가 로그인/회원가입 페이지 접근 시 대시보드로 리다이렉트
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes - 로그인 필요
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    // 로그인 후 원래 페이지로 돌아가기 위한 callbackUrl 설정
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
