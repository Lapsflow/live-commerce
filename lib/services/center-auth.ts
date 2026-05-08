import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

/**
 * 센터 코드로 로그인 시 SUB_MASTER 자동 생성/조회
 *
 * 1. username이 Center.code와 매칭되는지 확인
 * 2. 매칭되면 해당 센터의 SUB_MASTER 계정 조회
 * 3. 없으면 자동 생성 (초기 비밀번호 = 센터 코드)
 * 4. 사용자 반환 (비밀번호 검증은 호출 측에서)
 */
export async function findOrCreateCenterAccount(centerCode: string) {
  // 센터 코드로 센터 조회
  const center = await prisma.center.findFirst({
    where: { code: centerCode },
    select: { id: true, name: true, code: true },
  });

  if (!center) return null;

  // 해당 센터의 SUB_MASTER 계정 조회
  let user = await prisma.user.findFirst({
    where: {
      centerId: center.id,
      role: "SUB_MASTER",
      username: centerCode,
    },
    include: {
      center: { select: { id: true, name: true, code: true } },
    },
  });

  if (user) return user;

  // SUB_MASTER 계정 자동 생성
  const passwordHash = await bcrypt.hash(centerCode, 10);

  user = await prisma.user.create({
    data: {
      username: centerCode,
      name: `${center.name} 관리자`,
      email: `${centerCode}@center.local`,
      phone: "",
      role: "SUB_MASTER",
      centerId: center.id,
      passwordHash,
      isActive: true,
      contractStatus: "APPROVED",
      mustChangePassword: true,
    },
    include: {
      center: { select: { id: true, name: true, code: true } },
    },
  });

  return user;
}
