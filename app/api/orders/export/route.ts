import { NextRequest } from "next/server";
import { error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

/**
 * GET /api/orders/export — 발주 엑셀 다운로드
 *
 * 두 가지 모드:
 * 1) type=wms|center — 기존 주문서 양식 (슈퍼무진/자사몰, 품목 단위 행) 유지
 * 2) type 미지정 — 전체 발주내역 (발주 단위 행, 현재 화면 필터 그대로 반영)
 *    발주관리 개선 (2026-07-10, 한국무진 요청 2번)
 *
 * 공통 필터: startDate/endDate(구) 또는 fromDate/toDate(신, 종료일 당일 포함),
 *            status, paymentStatus, shippingStatus, sellerId, productType, search
 * 권한: SELLER 본인, SUB_MASTER 소속 센터 셀러 (기존엔 SUB_MASTER 격리 누락 — 함께 수정)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "wms" | "center" | null;

    // 날짜: 구(startDate/endDate)·신(fromDate/toDate) 파라미터 모두 수용
    const fromDateParam = searchParams.get("fromDate") ?? searchParams.get("startDate");
    const toDateParam = searchParams.get("toDate") ?? searchParams.get("endDate");

    const ORDER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
    const PAYMENT_STATUSES = ["UNPAID", "PENDING_CONFIRMATION", "PAID", "PAYMENT_FAILED", "ON_HOLD"];
    const SHIPPING_STATUSES = ["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "PARTIAL"];

    const statusParam = searchParams.get("status");
    const paymentStatusParam = searchParams.get("paymentStatus");
    const shippingStatusParam = searchParams.get("shippingStatus");
    const sellerIdParam = searchParams.get("sellerId");
    const productTypeParam = searchParams.get("productType");
    const search = searchParams.get("search");

    const where: any = {};

    if (type) {
      // 기존 주문서 양식 모드
      where.productType = type === "wms" ? "HEADQUARTERS" : "CENTER";
    } else if (productTypeParam === "HEADQUARTERS" || productTypeParam === "CENTER") {
      where.productType = productTypeParam;
    }

    if (statusParam && ORDER_STATUSES.includes(statusParam)) {
      where.status = statusParam;
    } else if (!type) {
      // 전체 발주내역 모드 기본: 취소 제외 (목록 화면과 동일)
      where.status = { not: "CANCELLED" };
    }
    if (paymentStatusParam && PAYMENT_STATUSES.includes(paymentStatusParam)) {
      where.paymentStatus = paymentStatusParam;
    }
    if (shippingStatusParam && SHIPPING_STATUSES.includes(shippingStatusParam)) {
      where.shippingStatus = shippingStatusParam;
    }
    if (sellerIdParam) {
      where.sellerId = sellerIdParam;
    }
    if (search) {
      where.orderNo = { contains: search, mode: "insensitive" };
    }

    // 기간 — 발주일 기준, 종료일 당일 포함
    if (fromDateParam || toDateParam) {
      where.createdAt = {};
      if (fromDateParam) where.createdAt.gte = new Date(fromDateParam);
      if (toDateParam) {
        where.createdAt.lt = new Date(new Date(toDateParam).getTime() + 24 * 60 * 60 * 1000);
      }
    }

    // 권한 격리 (목록 API 와 동일 규칙)
    if (session.user.role === "SELLER") {
      where.sellerId = session.user.userId;
    } else if (session.user.role === "SUB_MASTER" && (session.user as any).centerId) {
      where.seller = { centerId: (session.user as any).centerId };
    }

    // Fetch orders
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, barcode: true },
            },
          },
        },
        seller: {
          select: { name: true, phone: true, center: { select: { name: true } } },
        },
      },
    });

    if (orders.length === 0) {
      return error("NOT_FOUND", "내보낼 주문이 없습니다.", 404);
    }

    const PAYMENT_LABELS: Record<string, string> = {
      UNPAID: "입금확인전",
      PENDING_CONFIRMATION: "입금확인중",
      PAID: "입금완료",
      PAYMENT_FAILED: "결제실패",
      ON_HOLD: "보류",
    };
    const STATUS_LABELS: Record<string, string> = {
      PENDING: "발주요청",
      APPROVED: "승인",
      REJECTED: "반려",
      CANCELLED: "취소",
    };
    const SHIPPING_LABELS: Record<string, string> = {
      PENDING: "배송대기",
      PREPARING: "배송준비중",
      SHIPPED: "배송중",
      DELIVERED: "배송완료",
      PARTIAL: "부분배송",
    };

    let excelData: Record<string, unknown>[];
    let sheetName: string;
    let filename: string;
    const today = new Date().toISOString().split("T")[0];

    if (type) {
      // ── 기존 주문서 양식 (품목 단위 행) ──
      excelData = orders.flatMap((order) =>
        order.items.map((item) => ({
          주문번호: order.orderNo,
          상품명: item.productName,
          바코드: item.barcode,
          수량: item.quantity,
          단가: item.supplyPrice,
          합계금액: item.totalSupply,
          주문일시: new Date(order.createdAt).toLocaleString("ko-KR"),
          고객명: order.recipient || order.seller?.name || "",
          연락처: order.phone || order.seller?.phone || "",
          배송주소: order.address || "",
        }))
      );
      sheetName = type === "wms" ? "슈퍼무진 주문서" : "자사몰 주문서";
      filename =
        type === "wms" ? `슈퍼무진_주문서_${today}.xlsx` : `자사몰_주문서_${today}.xlsx`;
    } else {
      // ── 전체 발주내역 (발주 단위 행) ──
      excelData = orders.map((order) => ({
        발주번호: order.orderNo,
        셀러명: order.seller?.name || "삭제된 사용자",
        센터: order.seller?.center?.name || "",
        발주일: new Date(order.createdAt).toLocaleString("ko-KR"),
        발주상태: STATUS_LABELS[order.status] ?? order.status,
        입금상태: PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus,
        입금일: order.paidAt ? new Date(order.paidAt).toLocaleDateString("ko-KR") : "",
        출고상태: SHIPPING_LABELS[order.shippingStatus] ?? order.shippingStatus,
        "수량(EA)": order.items.reduce((sum, item) => sum + item.quantity, 0),
        발주금액: order.totalAmount,
        미입금액: order.paymentStatus === "PAID" ? 0 : order.totalAmount,
      }));
      sheetName = "발주내역";
      filename = `발주내역_${today}.xlsx`;
    }

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Return Excel file
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err: any) {
    console.error("[ORDER EXPORT ERROR]", err);
    return error("EXPORT_FAILED", err.message, 500);
  }
}
