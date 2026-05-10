import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const proposalCreateSchema = z.object({
  companyName: z.string().min(1, "업체명을 입력하세요"),
  contact: z.string().min(1, "담당자를 입력하세요"),
  phone: z.string().min(1, "연락처를 입력하세요"),
  productName: z.string().min(1, "상품명을 입력하세요"),
  category: z.string().min(1, "카테고리를 입력하세요"),
  subcategory: z.string().optional(),
  description: z.string().min(1, "설명을 입력하세요"),
  // PROPOSAL-06: 이미지 (data URL도 허용하기 위해 url() 검증 제거)
  imageMain: z.string().optional(),
  imageSubs: z.string().optional(), // JSON 배열 문자열
  // PROPOSAL-06: 샘플/공급 정책
  sampleType: z.enum(["FREE", "PAID"]).optional(),
  samplePrice: z.number().int().min(0).optional(),
  quantityLimit: z.number().int().min(1).optional(),
  supplyType: z.enum(["SINGLE", "RECURRING"]).optional(),
  brand: z.string().optional(),
  productCode: z.string().optional(),
  // PROPOSAL-07: 쇼핑몰형 카드용 추가 필드 (모두 선택)
  onlineLowestPrice: z.number().int().min(0).optional(),
  supplyPrice: z.number().int().min(0).optional(),
  expiryDate: z.string().optional(), // YYYY-MM-DD
  stockQty: z.number().int().min(0).optional(),
});

/**
 * POST /api/proposals
 *
 * 제안 등록
 * 권한: MASTER만 가능
 * PROPOSAL-07: MASTER가 직접 올린 제안은 별도 승인 절차 없이 즉시 APPROVED 상태로 노출
 *
 * 주의: withRole이 이미 인증 + 권한 검증을 수행하고 user를 주입함.
 * 핸들러 내부에서 auth()를 다시 호출하면 API request 컨텍스트에서
 * 세션이 잡히지 않을 수 있으므로 user 파라미터를 그대로 사용해야 함.
 */
export const POST = withRole(
  ["MASTER"],
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const data = proposalCreateSchema.parse(body);

      // 신규 필드는 명시적으로 추출
      const {
        expiryDate,
        ...rest
      } = data;

      const proposal = await prisma.proposal.create({
        data: {
          ...rest,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          submittedBy: user.userId,
          // MASTER 등록은 즉시 노출 (withRole이 MASTER만 통과시키므로 항상 APPROVED)
          status: user.role === "MASTER" ? "APPROVED" : "PENDING",
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
 * - category?: 카테고리 필터 (대분류)
 *
 * 권한:
 * - MASTER, SUB_MASTER: 모든 제안 조회
 */
export const GET = withRole(
  ["MASTER", "SUB_MASTER"],
  async (req: NextRequest, _user) => {
    try {
      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get("status");
      const categoryFilter = searchParams.get("category");

      // where 조건 조립
      const where: any = {};
      if (statusFilter) {
        where.status = statusFilter as "PENDING" | "APPROVED" | "REJECTED";
      }
      if (categoryFilter) {
        where.category = categoryFilter;
      }

      const proposals = await prisma.proposal.findMany({
        where,
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
