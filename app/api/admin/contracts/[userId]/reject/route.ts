import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().min(1, "거부 사유를 입력해주세요."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const { userId } = await params;
    const body = await req.json();

    // Only MASTER or ADMIN can reject contracts
    const role = session?.user?.role;
    if (!session?.user || !role || !["MASTER", "ADMIN"].includes(role)) {
      return error("UNAUTHORIZED", "권한이 없습니다.", 403);
    }

    const data = rejectSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return error("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
    }

    if (user.role !== "SELLER") {
      return error(
        "NOT_SELLER",
        "판매자 계약만 거부할 수 있습니다.",
        400
      );
    }

    // Reject contract
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        contractStatus: "REJECTED",
        contractRejectionReason: data.reason,
        contractApprovedAt: null,
        contractApprovedBy: null,
      },
    });

    return ok({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      contractStatus: updatedUser.contractStatus,
      contractRejectionReason: updatedUser.contractRejectionReason,
      message: "계약이 거부되었습니다.",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return error("VALIDATION_ERROR", err.issues[0].message, 400);
    }
    console.error("[CONTRACT REJECT ERROR]", err);
    return error("REJECT_FAILED", err.message, 500);
  }
}
