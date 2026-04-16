import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  categories: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  timeSlots: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const validatedData = profileUpdateSchema.parse(body);

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // SELLER만 프로필 업데이트 가능
    if (user.role !== 'SELLER') {
      return NextResponse.json(
        { error: 'SELLER만 프로필을 업데이트할 수 있습니다' },
        { status: 403 }
      );
    }

    // 프로필 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        categories: validatedData.categories,
        regions: validatedData.regions,
        timeSlots: validatedData.timeSlots,
      },
      select: {
        id: true,
        name: true,
        categories: true,
        regions: true,
        timeSlots: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: '프로필 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
