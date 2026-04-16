import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * DEBUG ONLY: Check MASTER account status
 * DELETE THIS FILE after debugging!
 */
export async function GET(req: NextRequest) {
  try {
    const master = await prisma.user.findFirst({
      where: { role: "MASTER" },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!master) {
      return NextResponse.json({
        error: "No MASTER account found",
        suggestion: "Run: npx prisma db seed",
      });
    }

    return NextResponse.json({
      found: true,
      account: {
        id: master.id,
        username: master.username,
        email: master.email,
        name: master.name,
        role: master.role,
        hasPasswordHash: !!master.passwordHash,
        passwordHashLength: master.passwordHash?.length || 0,
        createdAt: master.createdAt,
      },
      diagnostic: {
        usernameExists: !!master.username,
        usernameValue: master.username,
        emailExists: !!master.email,
        emailValue: master.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: "Database error",
      message: error.message,
      suggestion: "Check DATABASE_URL and Prisma migrations",
    });
  }
}
