/**
 * Excel Bulk Upload — Option 2: Full Replace with Upsert by Barcode
 *
 * 매일 운영 도구: 바코드 기준으로 기존 상품 업데이트, 신규 추가, 미포함 상품 비활성화
 * 진행 중 발주(StockReservation)는 영향 없이 유지
 */

import { prisma } from "@/lib/db/prisma";
import { generateCenterProductCodeTx } from "./codeGenerator";
import { logAudit } from "@/lib/services/audit";
import type { AuthUser } from "@/lib/api/middleware";

// ─── Types ───

export interface ExcelProductRow {
  row: number;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  originalPrice: number;
  category: string;
  stock: number;
  notes: string;
}

export interface UpsertStats {
  updated: number;
  created: number;
  reactivated: number;
  deactivated: number;
}

export interface PriceChange {
  barcode: string;
  productName: string;
  field: string;
  oldValue: number;
  newValue: number;
}

export interface DeactivatedProduct {
  id: string;
  code: string;
  name: string;
  barcode: string;
  activeOrderCount: number;
}

export interface UpsertPreviewResult {
  stats: UpsertStats;
  priceChanges: PriceChange[];
  newProducts: Array<{ barcode: string; name: string; sellPrice: number; stock: number }>;
  deactivatedProducts: DeactivatedProduct[];
  totalActiveOrderCount: number;
  validationErrors: Array<{ row: number; barcode: string; error: string }>;
}

export interface UpsertExecuteResult {
  stats: UpsertStats;
  priceChanges: PriceChange[];
  deactivatedCount: number;
  totalActiveOrderCount: number;
  auditLogId: string;
  durationMs: number;
}

// ─── Validation ───

export function parseAndValidateExcel(
  rows: Array<Record<string, unknown>>
): { valid: ExcelProductRow[]; errors: Array<{ row: number; barcode: string; error: string }> } {
  const valid: ExcelProductRow[] = [];
  const errors: Array<{ row: number; barcode: string; error: string }> = [];
  const seenBarcodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // Excel row (header = row 1)

    const name = String(raw["상품명"] ?? "").trim();
    const barcode = String(raw["바코드"] ?? "").trim();
    const sellPrice = parseInt(String(raw["판매가"] ?? "0")) || 0;
    const supplyPrice = parseInt(String(raw["공급가"] ?? "0")) || 0;
    const originalPrice = parseInt(String(raw["원가"] ?? "0")) || 0;
    const category = String(raw["카테고리"] ?? "").trim();
    const stock = parseInt(String(raw["재고"] ?? "0")) || 0;
    const notes = String(raw["메모"] ?? "").trim();

    if (!barcode) {
      errors.push({ row: rowNum, barcode: "", error: "바코드 누락 (필수)" });
      continue;
    }

    if (!name) {
      errors.push({ row: rowNum, barcode, error: "상품명 누락" });
      continue;
    }

    if (sellPrice < 0) {
      errors.push({ row: rowNum, barcode, error: "판매가 음수" });
      continue;
    }

    if (supplyPrice < 0) {
      errors.push({ row: rowNum, barcode, error: "공급가 음수" });
      continue;
    }

    if (originalPrice < 0) {
      errors.push({ row: rowNum, barcode, error: "원가 음수" });
      continue;
    }

    if (seenBarcodes.has(barcode)) {
      errors.push({ row: rowNum, barcode, error: "엑셀 내 바코드 중복" });
      continue;
    }

    seenBarcodes.add(barcode);
    valid.push({ row: rowNum, name, barcode, sellPrice, supplyPrice, originalPrice, category, stock, notes });
  }

  return { valid, errors };
}

// ─── Build Plan (Preview) ───

export async function buildUpsertPlan(
  centerId: string,
  excelRows: ExcelProductRow[]
): Promise<UpsertPreviewResult> {
  // 1. 센터의 모든 CENTER 상품 조회 (active + inactive)
  const existing = await prisma.product.findMany({
    where: {
      managedBy: centerId,
      productType: "CENTER",
    },
    select: {
      id: true,
      code: true,
      name: true,
      barcode: true,
      sellPrice: true,
      supplyPrice: true,
      originalPrice: true,
      category: true,
      totalStock: true,
      notes: true,
      isActive: true,
    },
  });

  const existingByBarcode = new Map(existing.map((p) => [p.barcode, p]));
  const uploadedBarcodes = new Set(excelRows.map((r) => r.barcode));

  const stats: UpsertStats = { updated: 0, created: 0, reactivated: 0, deactivated: 0 };
  const priceChanges: PriceChange[] = [];
  const newProducts: UpsertPreviewResult["newProducts"] = [];
  const validationErrors: UpsertPreviewResult["validationErrors"] = [];

  // 2. 바코드가 다른 센터/HQ 소속인지 확인
  const allBarcodes = excelRows.map((r) => r.barcode);
  if (allBarcodes.length > 0) {
    const conflicting = await prisma.product.findMany({
      where: {
        barcode: { in: allBarcodes },
        NOT: { managedBy: centerId, productType: "CENTER" },
      },
      select: { barcode: true },
    });
    for (const c of conflicting) {
      const row = excelRows.find((r) => r.barcode === c.barcode);
      if (row) {
        validationErrors.push({
          row: row.row,
          barcode: c.barcode,
          error: "다른 센터 또는 본사 상품의 바코드입니다",
        });
      }
    }
  }

  if (validationErrors.length > 0) {
    return { stats, priceChanges, newProducts, deactivatedProducts: [], totalActiveOrderCount: 0, validationErrors };
  }

  // 3. 각 엑셀 행 분류
  for (const row of excelRows) {
    const existing = existingByBarcode.get(row.barcode);

    if (existing) {
      if (existing.isActive) {
        // UPDATE
        stats.updated++;
      } else {
        // REACTIVATE
        stats.reactivated++;
      }

      // 가격 변동 추적
      if (existing.sellPrice !== row.sellPrice) {
        priceChanges.push({
          barcode: row.barcode, productName: existing.name,
          field: "판매가", oldValue: existing.sellPrice, newValue: row.sellPrice,
        });
      }
      if (existing.supplyPrice !== row.supplyPrice) {
        priceChanges.push({
          barcode: row.barcode, productName: existing.name,
          field: "공급가", oldValue: existing.supplyPrice, newValue: row.supplyPrice,
        });
      }
    } else {
      // CREATE
      stats.created++;
      newProducts.push({ barcode: row.barcode, name: row.name, sellPrice: row.sellPrice, stock: row.stock });
    }
  }

  // 4. 비활성화 대상 (엑셀에 없는 활성 상품)
  const toDeactivate = existing.filter(
    (p) => p.isActive && !uploadedBarcodes.has(p.barcode)
  );
  stats.deactivated = toDeactivate.length;

  // 5. 비활성화 대상의 활성 발주 수 조회
  const deactivatedProducts: DeactivatedProduct[] = [];
  let totalActiveOrderCount = 0;

  if (toDeactivate.length > 0) {
    const deactivateIds = toDeactivate.map((p) => p.id);
    const reservationCounts = await prisma.stockReservation.groupBy({
      by: ["productId"],
      where: {
        productId: { in: deactivateIds },
        status: "ACTIVE",
      },
      _count: { id: true },
    });

    const countMap = new Map(reservationCounts.map((r) => [r.productId, r._count.id]));

    for (const p of toDeactivate) {
      const orderCount = countMap.get(p.id) ?? 0;
      totalActiveOrderCount += orderCount;
      deactivatedProducts.push({
        id: p.id, code: p.code, name: p.name, barcode: p.barcode,
        activeOrderCount: orderCount,
      });
    }
  }

  return { stats, priceChanges, newProducts, deactivatedProducts, totalActiveOrderCount, validationErrors };
}

// ─── Execute Upsert ───

export async function executeUpsert(
  centerId: string,
  excelRows: ExcelProductRow[],
  user: AuthUser,
  request?: Request | null
): Promise<UpsertExecuteResult> {
  const startTime = Date.now();

  // 1. 센터의 모든 CENTER 상품 조회 (트랜잭션 전)
  const existing = await prisma.product.findMany({
    where: {
      managedBy: centerId,
      productType: "CENTER",
    },
    select: {
      id: true,
      code: true,
      name: true,
      barcode: true,
      sellPrice: true,
      supplyPrice: true,
      originalPrice: true,
      category: true,
      totalStock: true,
      stockMujin: true,
      notes: true,
      isActive: true,
    },
  });

  const existingByBarcode = new Map(existing.map((p) => [p.barcode, p]));
  const uploadedBarcodes = new Set(excelRows.map((r) => r.barcode));

  const stats: UpsertStats = { updated: 0, created: 0, reactivated: 0, deactivated: 0 };
  const priceChanges: PriceChange[] = [];

  // 롤백용 before 상태 저장
  const updatedBefore: Record<string, Record<string, unknown>> = {};
  const updatedAfter: Record<string, Record<string, unknown>> = {};
  const createdProductIds: string[] = [];

  // 비활성화 대상
  const toDeactivate = existing.filter(
    (p) => p.isActive && !uploadedBarcodes.has(p.barcode)
  );

  // 활성 발주 수 (비활성화 대상)
  let totalActiveOrderCount = 0;
  if (toDeactivate.length > 0) {
    const count = await prisma.stockReservation.count({
      where: {
        productId: { in: toDeactivate.map((p) => p.id) },
        status: "ACTIVE",
      },
    });
    totalActiveOrderCount = count;
  }

  // 2. 트랜잭션 실행
  await prisma.$transaction(
    async (tx) => {
      for (const row of excelRows) {
        const existingProduct = existingByBarcode.get(row.barcode);

        if (existingProduct) {
          // Before 상태 저장 (롤백용)
          updatedBefore[existingProduct.id] = {
            name: existingProduct.name,
            sellPrice: existingProduct.sellPrice,
            supplyPrice: existingProduct.supplyPrice,
            originalPrice: existingProduct.originalPrice,
            category: existingProduct.category,
            totalStock: existingProduct.totalStock,
            stockMujin: existingProduct.stockMujin,
            notes: existingProduct.notes,
            isActive: existingProduct.isActive,
          };

          // 가격 변동 추적
          if (existingProduct.sellPrice !== row.sellPrice) {
            priceChanges.push({
              barcode: row.barcode, productName: existingProduct.name,
              field: "판매가", oldValue: existingProduct.sellPrice, newValue: row.sellPrice,
            });
          }
          if (existingProduct.supplyPrice !== row.supplyPrice) {
            priceChanges.push({
              barcode: row.barcode, productName: existingProduct.name,
              field: "공급가", oldValue: existingProduct.supplyPrice, newValue: row.supplyPrice,
            });
          }

          const updateData: Record<string, unknown> = {
            name: row.name,
            sellPrice: row.sellPrice,
            supplyPrice: row.supplyPrice,
            originalPrice: row.originalPrice || null,
            category: row.category || null,
            totalStock: row.stock,
            stockMujin: row.stock,
            notes: row.notes || null,
          };

          if (existingProduct.isActive) {
            stats.updated++;
          } else {
            // Reactivate
            stats.reactivated++;
            updateData.isActive = true;
            updateData.deactivatedAt = null;
            updateData.deactivatedReason = null;
          }

          await tx.product.update({
            where: { id: existingProduct.id },
            data: updateData,
          });

          updatedAfter[existingProduct.id] = {
            name: row.name,
            sellPrice: row.sellPrice,
            supplyPrice: row.supplyPrice,
            originalPrice: row.originalPrice,
            category: row.category,
            totalStock: row.stock,
            stockMujin: row.stock,
            notes: row.notes,
            isActive: true,
          };
        } else {
          // Create new product
          const code = await generateCenterProductCodeTx(centerId, tx);

          const created = await tx.product.create({
            data: {
              code,
              name: row.name,
              barcode: row.barcode,
              sellPrice: row.sellPrice,
              supplyPrice: row.supplyPrice,
              originalPrice: row.originalPrice || null,
              category: row.category || null,
              totalStock: row.stock,
              stockMujin: row.stock,
              productType: "CENTER",
              managedBy: centerId,
              isWmsProduct: false,
              registeredBy: user.userId,
              notes: row.notes || null,
            },
          });

          createdProductIds.push(created.id);
          stats.created++;
        }
      }

      // Deactivate products not in Excel
      if (toDeactivate.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: toDeactivate.map((p) => p.id) } },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedReason: "EXCEL_UPLOAD",
          },
        });
        stats.deactivated = toDeactivate.length;
      }
    },
    { timeout: 30000 }
  );

  const durationMs = Date.now() - startTime;

  // 3. AuditLog (fire-and-forget, 트랜잭션 밖)
  const centerInfo = await prisma.center.findUnique({
    where: { id: centerId },
    select: { name: true },
  });

  logAudit({
    userId: user.userId,
    userRole: user.role,
    userName: user.name,
    action: "IMPORT",
    entityType: "Product",
    entityId: centerId,
    entityName: `${centerInfo?.name ?? centerId} 엑셀 업로드 (Upsert)`,
    before: updatedBefore,
    after: updatedAfter,
    description: `엑셀 업로드: 업데이트 ${stats.updated}, 신규 ${stats.created}, 재활성화 ${stats.reactivated}, 비활성화 ${stats.deactivated} (${durationMs}ms)`,
    metadata: {
      mode: "UPSERT",
      stats,
      centerId,
      deactivatedProductIds: toDeactivate.map((p) => p.id),
      createdProductIds,
      priceChanges,
      durationMs,
    },
    request: request ?? null,
  });

  return {
    stats,
    priceChanges,
    deactivatedCount: stats.deactivated,
    totalActiveOrderCount,
    auditLogId: "", // AuditLog는 fire-and-forget이므로 ID 추적 불가
    durationMs,
  };
}
