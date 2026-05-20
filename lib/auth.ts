import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { securityLogger } from "@/lib/logger";
import { logAudit } from "@/lib/services/audit";
import { findOrCreateCenterAccount } from "@/lib/services/center-auth";

// Bug #8 fix: NextAuth v5 는 throw new Error() 의 message 를 클라이언트에 노출하지 않음.
// CredentialsSignin 클래스를 상속하고 code 프로퍼티를 지정해야 result.code 로 전달됨.
class AuthError extends CredentialsSignin {
  constructor(public code: string) {
    super(code);
  }
}

declare module "next-auth" {
  interface User {
    role?: string;
    centerId?: string;
    center?: { id: string; name: string; code: string } | null;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: User & {
      userId?: string;
      role?: string;
      centerId?: string;
      center?: { id: string; name: string; code: string } | null;
      mustChangePassword?: boolean;
    };
  }
  interface JWT {
    userId?: string;
    role?: string;
    centerId?: string;
    center?: { id: string; name: string; code: string } | null;
    mustChangePassword?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        if (!username || !credentials?.password) {
          securityLogger.authFailed({ reason: "missing_credentials" });
          return null;
        }

        let user = await prisma.user.findUnique({
          where: { username },
          include: {
            center: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        if (!user) {
          // 센터 코드로 로그인 시도 (SUB_MASTER 자동 생성)
          const centerUser = await findOrCreateCenterAccount(username);
          if (centerUser) {
            user = centerUser;
          } else {
            securityLogger.authFailed({ reason: "user_not_found", username });
            logAudit({
              action: "LOGIN_FAILED",
              entityType: "User",
              description: `로그인 실패 (존재하지 않는 사용자): ${username}`,
              metadata: { reason: "user_not_found", username },
            });
            return null;
          }
        }

        // 비밀번호 검증 — DEV_AUTH_BYPASS=true일 때만 스킵 (production 차단)
        const bypassEnabled =
          process.env.DEV_AUTH_BYPASS === "true" &&
          process.env.NODE_ENV !== "production";
        if (!bypassEnabled) {
          if (!user.passwordHash) {
            securityLogger.authFailed({ reason: "no_password_set", username });
            throw new AuthError("INVALID_CREDENTIALS");
          }
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          if (!isValid) {
            securityLogger.authFailed({ reason: "invalid_password", username });
            logAudit({
              userId: user.id,
              userRole: user.role,
              userName: user.name,
              action: "LOGIN_FAILED",
              entityType: "User",
              entityId: user.id,
              entityName: user.name,
              description: `로그인 실패 (비밀번호 불일치): ${username}`,
              metadata: { reason: "invalid_password" },
            });
            throw new AuthError("INVALID_CREDENTIALS");
          }
        }

        // isActive 체크 (비활성 계정 로그인 차단)
        if (user.isActive === false) {
          securityLogger.authFailed({
            reason: "account_deactivated",
            username,
          });
          throw new AuthError("ACCOUNT_DEACTIVATED");
        }

        // Phase 1: Contract status validation for SELLER role
        if (user.role === "SELLER") {
          if (user.contractStatus === "PENDING") {
            securityLogger.authFailed({
              reason: "contract_pending",
              username,
              contractStatus: user.contractStatus,
            });
            throw new AuthError("CONTRACT_PENDING");
          }

          if (user.contractStatus === "REJECTED") {
            securityLogger.authFailed({
              reason: "contract_rejected",
              username,
              contractStatus: user.contractStatus,
            });
            throw new AuthError("CONTRACT_REJECTED");
          }
        }

        logAudit({
          userId: user.id,
          userRole: user.role,
          userName: user.name,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
          entityName: user.name,
          description: `로그인 성공: ${username}`,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          centerId: user.centerId ?? undefined,
          center: user.center ?? undefined,
          mustChangePassword: user.mustChangePassword ?? false,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.centerId = user.centerId;
        token.center = user.center;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as string;
        session.user.centerId = token.centerId as string | undefined;
        session.user.center = token.center as { id: string; name: string; code: string } | null | undefined;
        session.user.mustChangePassword = token.mustChangePassword as boolean | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
