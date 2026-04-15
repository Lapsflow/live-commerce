import { NextRequest } from "next/server";
import { error } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

// Phase 2: Excel Export by Product Type
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return error("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "wms" | "center" | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!type) {
      return error("VALIDATION_ERROR", "type 파라미터가 필요합니다. (wms 또는 center)", 400);
    }

    const where: any = {
      productType: type === "wms" ? "HEADQUARTERS" : "CENTER",
    };

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Authorization: SELLER can only export their own orders
    if (session.user.role === "SELLER") {
      where.sellerId = session.user.userId;
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
          select: { name: true, phone: true },
        },
      },
    });

    if (orders.length === 0) {
      return error("NOT_FOUND", "내보낼 주문이 없습니다.", 404);
    }

    // Prepare Excel data
    const excelData = orders.flatMap((order) =>
      order.items.map((item) => ({
        주문번호: order.orderNo,
        상품명: item.productName,
        바코드: item.barcode,
        수량: item.quantity,
        단가: item.supplyPrice,
        합계금액: item.totalSupply,
        주문일시: new Date(order.createdAt).toLocaleString("ko-KR"),
        고객명: order.recipient || order.seller.name,
        연락처: order.phone || order.seller.phone || "",
        배송주소: order.address || "",
      }))
    );

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      type === "wms" ? "슈퍼무진 주문서" : "자사몰 주문서"
    );

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Set filename
    const filename =
      type === "wms"
        ? `슈퍼무진_주문서_${new Date().toISOString().split("T")[0]}.xlsx`
        : `자사몰_주문서_${new Date().toISOString().split("T")[0]}.xlsx`;

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
