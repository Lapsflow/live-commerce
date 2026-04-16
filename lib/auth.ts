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
        console.log("[AUTH DEBUG] Login attempt:", {
          hasUsername: !!credentials?.username,
          hasPassword: !!credentials?.password,
          username: credentials?.username,
          passwordLength: credentials?.password
            ? String(credentials.password).length
            : 0,
        });

        const username = credentials?.username as string | undefined;
        if (!username || !credentials?.password) {
          console.log("[AUTH DEBUG] Missing credentials");
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
          console.log("[AUTH DEBUG] User not found:", username);
          securityLogger.authFailed({ reason: "user_not_found", username });
          return null;
        }

        console.log("[AUTH DEBUG] User found:", {
          username,
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
            securityLogger.authFailed({ reason: "no_password_set", username });
            throw new Error("INVALID_CREDENTIALS");
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
            securityLogger.authFailed({ reason: "invalid_password", username });
            throw new Error("INVALID_CREDENTIALS");
          }
        }

        // Phase 1: Contract status validation for SELLER role
        if (user.role === "SELLER") {
          if (user.contractStatus === "PENDING") {
            console.log("[AUTH DEBUG] Contract approval pending:", username);
            securityLogger.authFailed({
              reason: "contract_pending",
              username,
              contractStatus: user.contractStatus,
            });
            throw new Error("CONTRACT_PENDING");
          }

          if (user.contractStatus === "REJECTED") {
            console.log("[AUTH DEBUG] Contract rejected:", username);
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
      console.log("[JWT Callback] token.role:", token.role, "token.userId:", token.userId);
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
      console.log("[Session Callback] session.user.role:", session.user?.role, "session.user.userId:", session.user?.userId);
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
