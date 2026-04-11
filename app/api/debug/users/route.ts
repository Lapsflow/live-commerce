import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

/**
 * DEBUG ONLY - 프로덕션 데이터베이스 사용자 확인용
 * 배포 후 삭제할 것
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkPassword = searchParams.get("check");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        passwordHash: checkPassword === "true" ? true : false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 비밀번호 체크 요청 시
    if (checkPassword === "true") {
      const masterUser = await prisma.user.findUnique({
        where: { email: "master@live-commerce.com" },
        select: { passwordHash: true },
      });

      if (masterUser && masterUser.passwordHash) {
        const testPassword = "master1234";
        const isValid = await bcrypt.compare(
          testPassword,
          masterUser.passwordHash
        );

        return NextResponse.json({
          success: true,
          count: users.length,
          passwordTest: {
            email: "master@live-commerce.com",
            testPassword: testPassword,
            hashExists: !!masterUser.passwordHash,
            hashLength: masterUser.passwordHash.length,
            hashPrefix: masterUser.passwordHash.substring(0, 20),
            bcryptCompareResult: isValid,
          },
          users: users.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            hasPasswordHash: !!(u as any).passwordHash,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: users.length,
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = error && typeof error === 'object' && 'code' in error ? (error as any).code : undefined;
    const stack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        success: false,
        error: message,
        code,
        stack,
      },
      { status: 500 }
    );
  }
}
