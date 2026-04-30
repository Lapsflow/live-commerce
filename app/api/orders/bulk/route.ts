import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, error, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import * as xlsx from "xlsx";
import { matchOrderItems, type MatchedItem } from "@/lib/services/orders/productMatching";
import { reserveStock } from "@/lib/services/stock/reservation";
import { matchOrderToBroadcast } from "@/lib/services/broadcast/orderBroadcastMatching";
import { logAudit } from "@/lib/services/audit";

const bulkDeleteSchema = z.object({
  orderIds: z.array(z.string()).min(1, "최소 1개의 주문을 선택해야 합니다"),
});

// ──────────────────────── POST: Excel 업로드 + 상품 매칭 ────────────────────────
// ORDER-01: 자동 매칭 (코드/바코드/제품명)
// ORDER-02: Stage 1 에러 반환 → Stage 2 담당자 검수
export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  async (req: NextRequest, user: AuthUser) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const isPreview = formData.get("preview") === "true";

      if (!file) {
        return errors.badRequest("파일이 필요합니다.");
      }

      // Excel 파싱
      const buffer = await file.arrayBuffer();
      const wb = xlsx.read(buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json<Record<string, any>>(ws);

      if (rows.length === 0) {
        return errors.badRequest("Excel 파일에 데이터가 없습니다.");
      }

      // Row → 매칭 입력 변환
      const items = rows.map((row) => ({
        code: String(row["상품코드"] || "").trim() || undefined,
        barcode: String(row["바코드"] || "").trim() || undefined,
        productName: String(row["상품명"] || "").trim() || undefined,
        quantity: parseInt(String(row["수량"] || "0")) || 1,
        totalAmount: parseInt(String(row["입금액"] || "0")) || 0,
        // 원본 행 데이터 보존
        orderNo: String(row["주문번호"] || "").trim(),
        recipient: String(row["수령자"] || "").trim(),
        phone: String(row["연락처"] || "").trim(),
        address: String(row["주소"] || "").trim(),
        memo: String(row["메모"] || "").trim(),
      }));

      // Stage 1: 상품 매칭
      const matchResults = await matchOrderItems(items);
      const matched = matchResults.filter((r) => r.matched);
      const unmatched = matchResults.filter((r) => !r.matched);

      // Preview 모드: 매칭 결과만 반환 (생성 안 함)
      if (isPreview) {
        return ok(
          matchResults.map((r, i) => ({
            rowIndex: i,
            orderNo: items[i].orderNo || "자동생성",
            recipient: items[i].recipient,
            phone: items[i].phone,
            productName: r.product?.name || items[i].productName || "(미매칭)",
            productCode: r.product?.code || items[i].code || "",
            barcode: r.product?.barcode || items[i].barcode || "",
            quantity: items[i].quantity,
            totalAmount: items[i].totalAmount,
            supplyPrice: r.product?.supplyPrice || 0,
            margin: r.product
              ? items[i].totalAmount - r.product.supplyPrice * items[i].quantity
              : 0,
            matched: r.matched,
            matchMethod: r.matchMethod || null,
            error: r.error || null,
          }))
        );
      }

      // Stage 1 에러: 매칭 실패 항목이 있으면 에러 반환
      if (unmatched.length > 0) {
        return error(
          "MATCHING_FAILED",
          `${unmatched.length}건의 상품이 매칭되지 않았습니다. 수정 후 재업로드해주세요.`,
          400,
          {
            totalItems: items.length,
            matchedCount: matched.length,
            unmatchedCount: unmatched.length,
            unmatchedItems: unmatched.map((r) => ({
              rowIndex: r.rowIndex,
              input: r.input,
              error: r.error,
            })),
          }
        );
      }

      // 전체 매칭 성공 → 주문 생성 (Stage 2는 PENDING 상태로 담당자 검수 대기)
      const sellerId = user.userId;
      let created = 0;

      // 주문번호별 그룹핑 (같은 주문번호 = 같은 주문의 여러 아이템)
      const orderGroups = new Map<string, { items: typeof items; matches: MatchedItem[] }>();
      for (let i = 0; i < items.length; i++) {
        const key = items[i].orderNo || `AUTO-${Date.now()}-${i}`;
        if (!orderGroups.has(key)) {
          orderGroups.set(key, { items: [], matches: [] });
        }
        orderGroups.get(key)!.items.push(items[i]);
        orderGroups.get(key)!.matches.push(matchResults[i]);
      }

      for (const [orderNoKey, group] of orderGroups) {
        const firstItem = group.items[0];
        const orderNo = orderNoKey.startsWith("AUTO-")
          ? `ORD-${Date.now().toString(36).toUpperCase()}-${(created + 1).toString().padStart(3, "0")}`
          : orderNoKey;

        const totalAmount = group.items.reduce((sum, it) => sum + it.totalAmount, 0);
        const totalSupply = group.matches.reduce(
          (sum, m, i) => sum + (m.product?.supplyPrice || 0) * group.items[i].quantity,
          0
        );

        // 상품 유형 결정
        const productTypes = group.matches.map((m) => m.product?.productType);
        const hasWms = productTypes.includes("HEADQUARTERS");
        const hasCenter = productTypes.includes("CENTER");
        const productType = hasWms && !hasCenter ? "HEADQUARTERS" as const
          : !hasWms && hasCenter ? "CENTER" as const
          : null;

        const order = await prisma.order.create({
          data: {
            orderNo,
            sellerId,
            status: "PENDING", // Stage 2: 담당자 검수 대기
            totalAmount,
            totalMargin: totalAmount - totalSupply,
            memo: firstItem.memo || undefined,
            recipient: firstItem.recipient || undefined,
            phone: firstItem.phone || undefined,
            address: firstItem.address || undefined,
            productType,
            items: {
              create: group.matches.map((m, i) => ({
                productId: m.product!.id,
                quantity: group.items[i].quantity,
                barcode: m.product!.barcode,
                productName: m.product!.name,
                supplyPrice: m.product!.supplyPrice,
                totalSupply: m.product!.supplyPrice * group.items[i].quantity,
                margin: group.items[i].totalAmount - m.product!.supplyPrice * group.items[i].quantity,
                productType: (m.product!.productType as "HEADQUARTERS" | "CENTER") || "HEADQUARTERS",
              })),
            },
          },
        });

        // 재고 선점
        try {
          await reserveStock(order.id);
        } catch (err) {
          console.error("[BULK ORDER] Stock reserve failed:", order.id, err);
        }

        // 방송 매칭
        try {
          await matchOrderToBroadcast(order.id, sellerId, new Date());
        } catch (err) {
          console.error("[BULK ORDER] Broadcast match failed:", order.id, err);
        }

        created++;
      }

      logAudit({
        userId: user.userId,
        userRole: user.role,
        userName: user.name,
        action: "IMPORT",
        entityType: "Order",
        entityName: `Excel 발주 업로드`,
        after: { created, totalItems: items.length },
        description: `발주 일괄등록: ${created}건 (Excel)`,
        request: req,
      });

      return ok({
        created,
        totalItems: items.length,
        message: `${created}건의 발주가 생성되었습니다. 담당자 검수를 기다려주세요.`,
      });
    } catch (err: any) {
      console.error("[BULK ORDER ERROR]", err);
      return errors.internal(err.message || "발주 업로드 실패");
    }
  }
);

// ──────────────────────── DELETE: 일괄 삭제 ────────────────────────
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const data = bulkDeleteSchema.parse(body);

      const results = await prisma.$transaction(async (tx) => {
        const deleteResults: Array<{
          id: string;
          success: boolean;
          error?: string;
        }> = [];

        for (const orderId of data.orderIds) {
          try {
            const existing = await tx.order.findUnique({
              where: { id: orderId },
            });

            if (!existing) {
              deleteResults.push({
                id: orderId,
                success: false,
                error: "주문을 찾을 수 없습니다",
              });
              continue;
            }

            await tx.order.delete({
              where: { id: orderId },
            });

            deleteResults.push({
              id: orderId,
              success: true,
            });
          } catch (err: any) {
            deleteResults.push({
              id: orderId,
              success: false,
              error: err.message || "삭제 실패",
            });
          }
        }

        return deleteResults;
      });

      const deleted = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return ok({
        deleted,
        failed,
        results,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return errors.badRequest(err.issues[0].message);
      }
      return errors.internal(err.message);
    }
  }
);
