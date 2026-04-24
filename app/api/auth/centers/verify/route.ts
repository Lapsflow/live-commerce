/**
 * GET /api/auth/centers/verify?code=XX-XXXX
 * 회원가입 시 센터 코드 검증 (인증 불필요)
 */

import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { validateCenterCode } from "@/lib/validators/center";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim() || "";

  if (!validateCenterCode(code)) {
    return ok({ valid: false });
  }

  const center = await prisma.center.findUnique({
    where: { code },
    select: { name: true, isActive: true },
  });

  if (!center || !center.isActive) {
    return ok({ valid: false });
  }

  return ok({ valid: true, centerName: center.name });
}
