import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if user has auth cookie
  const authCookie = req.cookies.get("authjs.session-token") || req.cookies.get("__Secure-authjs.session-token");
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
