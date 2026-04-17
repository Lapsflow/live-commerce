import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, errors } from '@/lib/api/response';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  categories: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  timeSlots: z.array(z.string()).optional(),
});

export const PATCH = withRole(["MASTER", "ADMIN", "SELLER"], async (
  req: NextRequest,
  user: AuthUser,
  context: { params: Promise<{ id: string }> }
) => {
  const { id } = await context.params;
  const body = await req.json();
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return errors.badRequest(parsed.error.issues[0].message, parsed.error.issues);
  }

  // 본인 프로필만 수정 가능 (MASTER/ADMIN은 예외)
  if (user.role === "SELLER" && user.userId !== id) {
    return errors.forbidden("본인의 프로필만 수정할 수 있습니다.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!targetUser) {
    return errors.notFound('사용자');
  }

  // SELLER만 프로필 업데이트 가능
  if (targetUser.role !== 'SELLER') {
    return errors.forbidden('SELLER만 프로필을 업데이트할 수 있습니다.');
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      categories: parsed.data.categories,
      regions: parsed.data.regions,
      timeSlots: parsed.data.timeSlots,
    },
    select: {
      id: true,
      name: true,
      categories: true,
      regions: true,
      timeSlots: true,
    },
  });

  return ok(updatedUser);
});
