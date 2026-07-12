/**
 * GET /api/orders/summary — 발주 현황 요약 (전체 KPI + 셀러별 집계)
 *
 * 발주관리 개선 (2026-07-10, 한국무진 요청 1번):
 * - 전체: 발주금액 / 발주건수 / 상품수량(EA) / 입금완료액 / 미입금액
 * - 셀러별: 발주건수 / 발주금액 / EA / 입금금액 / 미입금금액 / 입금상태
 *
 * 집계 기준:
 * - status IN (PENDING, APPROVED) — 반려/취소 발주는 현황에서 제외
 * - 기간은 발주일(createdAt) 기준, 종료일 당일 포함 (고객 확정)
 * - 건별 전액 입금 전제 → 입금금액 = PAID 발주 합계 (고객 답변 1)
 * - 집계는 전부 DB 에서 수행 (학습 #10 — 전체 row 로드 금지)
 *
 * Query: fromDate?, toDate?, productType?, sellerId?
 */

import { NextRequest } from 'next/server';
import { withRole, type AuthUser } from '@/lib/api/middleware';
import { ok } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@/lib/generated/prisma/client';

export const maxDuration = 30;

export const GET = withRole(
  ['MASTER', 'SUB_MASTER', 'SELLER'],
  async (req: NextRequest, user: AuthUser) => {
    const { searchParams } = new URL(req.url);
    const fromDateParam = searchParams.get('fromDate');
    const toDateParam = searchParams.get('toDate');
    const productTypeParam = searchParams.get('productType');
    const sellerIdParam = searchParams.get('sellerId');

    const productType =
      productTypeParam === 'HEADQUARTERS' || productTypeParam === 'CENTER'
        ? productTypeParam
        : null;
    const fromDate = fromDateParam ? new Date(fromDateParam) : null;
    const toDateEnd = toDateParam
      ? new Date(new Date(toDateParam).getTime() + 24 * 60 * 60 * 1000)
      : null;

    // ── Prisma where (groupBy 용) ──
    const where: Record<string, unknown> = {
      status: { in: ['PENDING', 'APPROVED'] },
    };
    if (productType) where.productType = productType;
    if (fromDate || toDateEnd) {
      where.createdAt = {
        ...(fromDate && { gte: fromDate }),
        ...(toDateEnd && { lt: toDateEnd }),
      };
    }
    if (sellerIdParam) where.sellerId = sellerIdParam;

    // 역할 격리 (orders GET 과 동일 규칙)
    if (user.role === 'SELLER') {
      where.sellerId = user.userId;
    } else if (user.role === 'SUB_MASTER' && user.centerId) {
      where.seller = { centerId: user.centerId };
    }

    // ── raw SQL 공통 조건 (EA 집계용 — Prisma.sql 조각으로 동일 필터 구성) ──
    const conditions: Prisma.Sql[] = [
      Prisma.sql`o."status"::text IN ('PENDING', 'APPROVED')`,
    ];
    if (productType) conditions.push(Prisma.sql`o."productType"::text = ${productType}`);
    if (fromDate) conditions.push(Prisma.sql`o."createdAt" >= ${fromDate}`);
    if (toDateEnd) conditions.push(Prisma.sql`o."createdAt" < ${toDateEnd}`);
    if (sellerIdParam) conditions.push(Prisma.sql`o."sellerId" = ${sellerIdParam}`);
    if (user.role === 'SELLER') {
      conditions.push(Prisma.sql`o."sellerId" = ${user.userId}`);
    } else if (user.role === 'SUB_MASTER' && user.centerId) {
      conditions.push(
        Prisma.sql`o."sellerId" IN (SELECT id FROM "User" WHERE "centerId" = ${user.centerId})`
      );
    }
    const whereSql = Prisma.join(conditions, ' AND ');

    const [statusGroups, qtyBySeller] = await Promise.all([
      // 셀러 × 입금상태별 금액·건수 (전체/셀러별 집계 겸용)
      prisma.order.groupBy({
        by: ['sellerId', 'paymentStatus'],
        where,
        _sum: { totalAmount: true },
        _count: true,
      }),

      // 셀러별 상품수량(EA) — OrderItem 조인 집계
      prisma.$queryRaw<Array<{ sellerId: string; qty: number }>>(
        Prisma.sql`
          SELECT o."sellerId", COALESCE(SUM(oi.quantity), 0)::int AS qty
          FROM "Order" o
          JOIN "OrderItem" oi ON oi."orderId" = o.id
          WHERE ${whereSql}
          GROUP BY o."sellerId"
        `
      ),
    ]);

    // ── 셀러별 합산 ──
    interface SellerAgg {
      sellerId: string;
      orderCount: number;
      totalAmount: number;
      paidAmount: number;
      unpaidAmount: number;
      totalQty: number;
    }
    const bySellerMap = new Map<string, SellerAgg>();
    const getAgg = (sellerId: string): SellerAgg => {
      let agg = bySellerMap.get(sellerId);
      if (!agg) {
        agg = { sellerId, orderCount: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0, totalQty: 0 };
        bySellerMap.set(sellerId, agg);
      }
      return agg;
    };

    for (const g of statusGroups) {
      const agg = getAgg(g.sellerId);
      const amount = g._sum.totalAmount || 0;
      agg.orderCount += g._count;
      agg.totalAmount += amount;
      if (g.paymentStatus === 'PAID') {
        agg.paidAmount += amount;
      } else {
        // UNPAID / PENDING_CONFIRMATION / PAYMENT_FAILED → 미입금으로 분류
        agg.unpaidAmount += amount;
      }
    }
    for (const q of qtyBySeller) {
      getAgg(q.sellerId).totalQty += q.qty;
    }

    // 셀러 이름 조회
    const sellerIds = Array.from(bySellerMap.keys());
    const sellers = sellerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: sellerIds } },
          select: {
            id: true,
            name: true,
            paymentMethod: true, // 요청 5·6번: 결제방식 표시·월결제 업체 구분
            center: { select: { name: true } },
          },
        })
      : [];
    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    // 셀러 단위 입금상태 판정: 완납 / 일부입금(일부 발주만 입금) / 미입금
    const bySeller = Array.from(bySellerMap.values())
      .map((agg) => {
        const seller = sellerMap.get(agg.sellerId);
        const paymentState =
          agg.unpaidAmount === 0 ? '완납' : agg.paidAmount === 0 ? '미입금' : '일부입금';
        return {
          ...agg,
          sellerName: seller?.name ?? '알 수 없음',
          centerName: seller?.center?.name ?? null,
          paymentMethod: seller?.paymentMethod ?? 'PREPAID',
          paymentState,
        };
      })
      // 미입금 큰 순 → 발주금액 큰 순
      .sort((a, b) => b.unpaidAmount - a.unpaidAmount || b.totalAmount - a.totalAmount);

    // ── 전체 합계 ──
    const totals = bySeller.reduce(
      (acc, s) => {
        acc.orderCount += s.orderCount;
        acc.totalAmount += s.totalAmount;
        acc.paidAmount += s.paidAmount;
        acc.unpaidAmount += s.unpaidAmount;
        acc.totalQty += s.totalQty;
        return acc;
      },
      { orderCount: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0, totalQty: 0 }
    );

    return ok({ totals, bySeller });
  }
);
