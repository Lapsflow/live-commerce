import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");

  if (!username || username.length < 3) {
    return error("INVALID", "아이디는 3자 이상이어야 합니다.", 400);
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return ok({ available: !existing });
}
