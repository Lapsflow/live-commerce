// lib/services/broadcast/broadcastService.ts
import { prisma } from '@/lib/db/prisma';

export async function startBroadcast(id: string, centerId: string | null, userId: string) {
  return await prisma.broadcast.update({
    where: { id },
    data: {
      centerId,
      status: 'LIVE',
      startedAt: new Date(),
    },
    include: {
      center: true,
    },
  });
}
