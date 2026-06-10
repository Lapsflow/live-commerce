import { NextRequest } from "next/server";
import { withRole, type AuthUser } from "@/lib/api/middleware";
import { ok, error, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import * as xlsx from "xlsx";
import { matchOrderItems, type MatchedItem } from "@/lib/services/orders/productMatching";
import { matchOrderToBroadcast } from "@/lib/services/broadcast/orderBroadcastMatching";
import { logAudit } from "@/lib/services/audit";
import { sanitizeMemo } from "@/lib/utils/memo";

const bulkDeleteSchema = z.object({
  orderIds: z.array(z.string()).min(1, "최소 1개의 주문을 선택해야 합니다"),
});

// ──────────────────────── POST: Excel 업로드 + 상품 매칭 ────────────────────────
// ORDER-01: 자동 매칭 (코드/바코드/제품명)
// ORDER-02: Stage 1 에러 반환 → Stage 2 담당자 검수
export const POST = withRole(
  ["MASTER", "SUB_MASTER", "SELLER"],
  async (req: NextRequest, user: AuthUser) => {
    // ✅ Task 4: Idempotency Key 검증 (catch 블록에서 접근할 수 있도록 외부에 선언)
    const idempotencyKey = req.headers.get("X-Idempotency-Key");
    let uploadJobId: string | null = null;

    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const isPreview = formData.get("preview") === "true";
      const isCreditTrade = formData.get("isCreditTrade") === "true";

      if (!file) {
        return errors.badRequest("파일이 필요합니다.");
      }

      if (!isPreview && idempotencyKey) {
        // 기존 요청 확인
        const existing = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });

        if (existing) {
          if (existing.status === "processing") {
            return errors.conflict("이미 처리 중인 업로드입니다. 30초 후 다시 시도해주세요.");
          }
          if (existing.status === "completed" && existing.response) {
            // ✅ B-3: 캐시된 응답 반환 (cached: true 플래그)
            return ok({ ...(existing.response as any), cached: true });
          }
        }

        // 새 요청 기록
        await prisma.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            endpoint: "POST /api/orders/bulk",
            userId: user.userId,
            expiresAt: new Date(Date.now() + 30000), // 30초 후 만료
          },
        });

        // ✅ Task 6: UploadJob 생성 (진행률 폴링용)
        // Job은 excel 파싱 후에 총 아이템 수가 나오므로 미리 생성할 수 없음
        // 매칭 후에 생성
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
      // 운영 검증(2026-05-26): 메모 셀에 템플릿의 placeholder "비고 (선택)" 가 그대로
      //   ONEWMS 로 전송되는 버그 발견. 셀러가 옛 템플릿 사용 중일 수 있으므로
      //   bulk 파싱 단계에서 placeholder 값 검출하여 빈 값으로 처리.
      // 2026-06-10: 필터 로직을 lib/utils/memo.ts 로 추출 (orderSync 동기화 시점과 공용)
      const items = rows.map((row) => {
        const memo = sanitizeMemo(String(row["메모"] || ""));
        return {
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
          memo,
        };
      });

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
      const createdOrders: any[] = []; // ✅ Task 1: 생성된 주문 배열

      // ✅ Task 6: UploadJob 생성 (진행률 추적)
      if (!isPreview && idempotencyKey) {
        uploadJobId = (
          await prisma.uploadJob.create({
            data: {
              userId: user.userId,
              endpoint: "POST /api/orders/bulk",
              totalItems: items.length,
            },
          })
        ).id;
      }

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

      // PDF §4.2: 혼합 발주(본사+센터)는 시스템이 본사 제품/센터 제품으로 자동 분리하여 각각 발주
      // 운영 검증(#5): 같은 주문번호에 본사·센터 제품이 섞여 있으면 2개의 Order 로 분할 생성
      for (const [orderNoKey, group] of orderGroups) {
        const firstItem = group.items[0];

        // productType 별 split (HEADQUARTERS / CENTER)
        const hqIndices: number[] = [];
        const ctIndices: number[] = [];
        group.matches.forEach((m, i) => {
          if (m.product?.productType === "HEADQUARTERS") hqIndices.push(i);
          else if (m.product?.productType === "CENTER") ctIndices.push(i);
        });

        const subGroups: Array<{
          productType: "HEADQUARTERS" | "CENTER";
          suffix: string;
          indices: number[];
        }> = [];
        if (hqIndices.length > 0) {
          subGroups.push({ productType: "HEADQUARTERS", suffix: "-HQ", indices: hqIndices });
        }
        if (ctIndices.length > 0) {
          subGroups.push({ productType: "CENTER", suffix: "-CT", indices: ctIndices });
        }

        // suffix 는 혼합일 때만 부여 (단일 type 이면 원본 orderNo 유지)
        const isSplit = subGroups.length > 1;

        for (const sub of subGroups) {
          const baseOrderNo = orderNoKey.startsWith("AUTO-")
            ? `ORD-${Date.now().toString(36).toUpperCase()}-${(created + 1).toString().padStart(3, "0")}`
            : orderNoKey;
          const orderNo = isSplit ? `${baseOrderNo}${sub.suffix}` : baseOrderNo;

          const subItems = sub.indices.map((i) => group.items[i]);
          const subMatches = sub.indices.map((i) => group.matches[i]);

          const totalAmount = subItems.reduce((sum, it) => sum + it.totalAmount, 0);
          const totalSupply = subMatches.reduce(
            (sum, m, idx) => sum + (m.product?.supplyPrice || 0) * subItems[idx].quantity,
            0
          );

          const order = await prisma.order.create({
            data: {
              orderNo,
              sellerId,
              status: "PENDING", // Stage 2: 담당자 검수 대기
              totalAmount,
              isCreditTrade,
              ...(isCreditTrade ? { paymentStatus: "PAID" as const, paidAt: new Date() } : {}),
              totalMargin: totalAmount - totalSupply,
              memo: firstItem.memo || undefined,
              recipient: firstItem.recipient || undefined,
              phone: firstItem.phone || undefined,
              address: firstItem.address || undefined,
              productType: sub.productType,
              items: {
                create: subMatches.map((m, idx) => ({
                  productId: m.product!.id,
                  quantity: subItems[idx].quantity,
                  barcode: m.product!.barcode,
                  productName: m.product!.name,
                  supplyPrice: m.product!.supplyPrice,
                  totalSupply: m.product!.supplyPrice * subItems[idx].quantity,
                  margin: subItems[idx].totalAmount - m.product!.supplyPrice * subItems[idx].quantity,
                  productType: sub.productType,
                })),
              },
            },
            include: { items: true },
          });

          createdOrders.push(order); // ✅ Task 1: 생성된 주문 저장

          // 방송 매칭
          try {
            await matchOrderToBroadcast(order.id, sellerId, new Date());
          } catch (err) {
            console.error("[BULK ORDER] Broadcast match failed:", order.id, err);
          }

          created++;

          // ✅ Task 6: UploadJob 진행률 업데이트
          if (uploadJobId) {
            await prisma.uploadJob.update({
              where: { id: uploadJobId },
              data: { processedItems: created },
            });
          }
        }
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

      const response = {
        created,
        totalItems: items.length,
        message: `${created}건의 발주가 생성되었습니다. 담당자 검수를 기다려주세요.`,
        ...(uploadJobId && { jobId: uploadJobId }),
      };

      // ✅ Task 4: IdempotencyKey 응답 캐싱
      if (idempotencyKey) {
        await prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            status: "completed",
            response,
          },
        });
      }

      // ✅ Task 6: UploadJob 완료
      if (uploadJobId) {
        await prisma.uploadJob.update({
          where: { id: uploadJobId },
          data: {
            status: "completed",
            result: response,
          },
        });
      }

      return ok(response);
    } catch (err: any) {
      console.error("[BULK ORDER ERROR]", err);

      // ✅ Task 4: IdempotencyKey 실패 기록
      if (idempotencyKey) {
        await prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            status: "failed",
            errorMsg: err.message,
          },
        }).catch((updateErr) => {
          console.error("[BULK ORDER] Failed to update IdempotencyKey:", updateErr);
        });
      }

      // ✅ Task 6: UploadJob 실패 기록
      if (uploadJobId) {
        await prisma.uploadJob.update({
          where: { id: uploadJobId },
          data: {
            status: "failed",
            errorMessage: err.message,
          },
        }).catch((updateErr) => {
          console.error("[BULK ORDER] Failed to update UploadJob:", updateErr);
        });
      }

      return errors.internal(err.message || "발주 업로드 실패");
    }
  }
);

// ──────────────────────── DELETE: 일괄 삭제 ────────────────────────
export const DELETE = withRole(
  ["MASTER", "SUB_MASTER"],
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
