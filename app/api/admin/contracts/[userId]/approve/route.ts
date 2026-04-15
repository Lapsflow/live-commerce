import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { withRole } from "@/lib/middleware/withRole";

// Phase 2: withRole() middleware applied (ADMIN only)
export const POST = withRole("ADMIN")(async (
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) => {
  try {
    const session = await auth();
    const { userId } = await params;

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
        "판매자 계약만 승인할 수 있습니다.",
        400
      );
    }

    // Approve contract
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        contractStatus: "APPROVED",
        contractApprovedAt: new Date(),
        contractApprovedBy: session.user.userId,
        contractRejectionReason: null, // Clear rejection reason if any
      },
    });

    return ok({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      contractStatus: updatedUser.contractStatus,
      contractApprovedAt: updatedUser.contractApprovedAt,
      message: "계약이 승인되었습니다. 사용자가 이제 로그인할 수 있습니다.",
    });
  } catch (err: any) {
    console.error("[CONTRACT APPROVE ERROR]", err);
    return error("APPROVE_FAILED", err.message, 500);
  }
});
