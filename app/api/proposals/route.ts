import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const proposalCreateSchema = z.object({
  companyName: z.string().min(1, "업체명을 입력하세요"),
  contact: z.string().min(1, "담당자를 입력하세요"),
  phone: z.string().min(1, "연락처를 입력하세요"),
  productName: z.string().min(1, "상품명을 입력하세요"),
  category: z.string().min(1, "카테고리를 입력하세요"),
  subcategory: z.string().optional(),
  description: z.string().min(1, "설명을 입력하세요"),
  // PROPOSAL-06: 이미지
  imageMain: z.string().url().optional(),
  imageSubs: z.string().optional(), // JSON 배열 문자열
  // PROPOSAL-06: 샘플/공급 정책
  sampleType: z.enum(["FREE", "PAID"]).optional(),
  samplePrice: z.number().int().min(0).optional(),
  quantityLimit: z.number().int().min(1).optional(),
  supplyType: z.enum(["SINGLE", "RECURRING"]).optional(),
  brand: z.string().optional(),
  productCode: z.string().optional(),
});

/**
 * POST /api/proposals
 *
 * 제안 등록
 * 권한: 모든 로그인 사용자
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userId = (session.user as any).userId;

      const body = await req.json();
      const data = proposalCreateSchema.parse(body);

      const proposal = await prisma.proposal.create({
        data: {
          ...data,
          submittedBy: userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return ok(proposal);
    } catch (err: any) {
      console.error("Proposal create error:", err);

      if (err.name === "ZodError") {
        return errors.badRequest(err.issues[0].message);
      }

      return errors.internal(err.message);
    }
  }
);

/**
 * GET /api/proposals
 *
 * 제안 목록 조회
 *
 * Query Parameters:
 * - status?: PENDING | APPROVED | REJECTED
 *
 * 권한:
 * - SELLER: 본인 제안만 조회
 * - MASTER, SUB_MASTER: 모든 제안 조회
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER", "SELLER"],
  async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return errors.unauthorized();
      }

      const userRole = (session.user as any).role;
      const userId = (session.user as any).userId;
      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get("status");

      // 역할별 필터
      let userFilter = {};
      if (userRole === "SELLER") {
        userFilter = { submittedBy: userId };
      }

      // 상태 필터
      const statusWhere = statusFilter
        ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
        : {};

      const proposals = await prisma.proposal.findMany({
        where: {
          ...userFilter,
          ...statusWhere,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return ok(proposals);
    } catch (err: any) {
      console.error("Proposals list error:", err);
      return errors.internal(err.message);
    }
  }
);
