import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { securityLogger } from "@/lib/logger";

declare module "next-auth" {
  interface User {
    role?: string;
    adminId?: string;
    centerId?: string;
    center?: { id: string; name: string; code: string } | null;
  }
  interface Session {
    user: User & {
      userId?: string;
      role?: string;
      adminId?: string;
      centerId?: string;
      center?: { id: string; name: string; code: string } | null;
    };
  }
  interface JWT {
    userId?: string;
    role?: string;
    adminId?: string;
    centerId?: string;
    center?: { id: string; name: string; code: string } | null;
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

        const user = await prisma.user.findUnique({
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
          securityLogger.authFailed({ reason: "user_not_found", username });
          return null;
        }

        // 비밀번호 검증 — DEV_AUTH_BYPASS=true일 때만 스킵 (production 차단)
        const bypassEnabled =
          process.env.DEV_AUTH_BYPASS === "true" &&
          process.env.NODE_ENV !== "production";
        if (!bypassEnabled) {
          if (!user.passwordHash) {
            securityLogger.authFailed({ reason: "no_password_set", username });
            throw new Error("INVALID_CREDENTIALS");
          }
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          if (!isValid) {
            securityLogger.authFailed({ reason: "invalid_password", username });
            throw new Error("INVALID_CREDENTIALS");
          }
        }

        // isActive 체크 (비활성 계정 로그인 차단)
        if (user.isActive === false) {
          securityLogger.authFailed({
            reason: "account_deactivated",
            username,
          });
          throw new Error("ACCOUNT_DEACTIVATED");
        }

        // Phase 1: Contract status validation for SELLER role
        if (user.role === "SELLER") {
          if (user.contractStatus === "PENDING") {
            securityLogger.authFailed({
              reason: "contract_pending",
              username,
              contractStatus: user.contractStatus,
            });
            throw new Error("CONTRACT_PENDING");
          }

          if (user.contractStatus === "REJECTED") {
            securityLogger.authFailed({
              reason: "contract_rejected",
              username,
              contractStatus: user.contractStatus,
            });
            throw new Error("CONTRACT_REJECTED");
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          adminId: user.adminId ?? undefined,
          centerId: user.centerId ?? undefined,
          center: user.center ?? undefined,
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
        token.adminId = user.adminId;
        token.centerId = user.centerId;
        token.center = user.center;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as string;
        session.user.adminId = token.adminId as string | undefined;
        session.user.centerId = token.centerId as string | undefined;
        session.user.center = token.center as { id: string; name: string; code: string } | null | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
