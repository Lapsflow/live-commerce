import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { securityLogger } from "@/lib/logger";

declare module "next-auth" {
  interface User {
    role?: string;
    adminId?: string;
  }
  interface Session {
    user: User & {
      userId?: string;
      role?: string;
      adminId?: string;
    };
  }
  interface JWT {
    userId?: string;
    role?: string;
    adminId?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        console.log("[AUTH DEBUG] Login attempt:", {
          hasEmail: !!credentials?.email,
          hasPassword: !!credentials?.password,
          email: credentials?.email,
          passwordLength: credentials?.password
            ? String(credentials.password).length
            : 0,
        });

        const email = credentials?.email as string | undefined;
        if (!email || !credentials?.password) {
          console.log("[AUTH DEBUG] Missing credentials");
          securityLogger.authFailed({ reason: "missing_credentials" });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          console.log("[AUTH DEBUG] User not found:", email);
          securityLogger.authFailed({ reason: "user_not_found", email });
          return null;
        }

        console.log("[AUTH DEBUG] User found:", {
          email,
          hasPasswordHash: !!user.passwordHash,
          passwordHashLength: user.passwordHash?.length || 0,
        });

        // 비밀번호 검증 — DEV_AUTH_BYPASS=true일 때만 스킵 (production 차단)
        const bypassEnabled =
          process.env.DEV_AUTH_BYPASS === "true" &&
          process.env.NODE_ENV !== "production";
        if (!bypassEnabled) {
          if (!user.passwordHash) {
            console.log("[AUTH DEBUG] No password hash set");
            securityLogger.authFailed({ reason: "no_password_set", email });
            return null;
          }
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          console.log("[AUTH DEBUG] Password comparison result:", {
            isValid,
            inputPassword: String(credentials.password).substring(0, 3) + "***",
            hashPrefix: user.passwordHash.substring(0, 20),
          });
          if (!isValid) {
            securityLogger.authFailed({ reason: "invalid_password", email });
            return null;
          }
        }

        // Check contract approval status for SELLER role (Phase 1)
        if (user.role === "SELLER" && user.contractStatus === "PENDING") {
          console.log("[AUTH DEBUG] Contract approval pending:", email);
          securityLogger.authFailed({
            reason: "contract_pending",
            email,
            contractStatus: user.contractStatus,
          });
          return null;
        }

        if (user.role === "SELLER" && user.contractStatus === "REJECTED") {
          console.log("[AUTH DEBUG] Contract rejected:", email);
          securityLogger.authFailed({
            reason: "contract_rejected",
            email,
            contractStatus: user.contractStatus,
          });
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          adminId: user.adminId ?? undefined,
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
      }
      console.log("[JWT Callback] token.role:", token.role, "token.userId:", token.userId);
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as string;
        session.user.adminId = token.adminId as string | undefined;
      }
      console.log("[Session Callback] session.user.role:", session.user?.role, "session.user.userId:", session.user?.userId);
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
