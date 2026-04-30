import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { generateCenterBarcodes } from "@/lib/utils/barcode-generator";
import * as XLSX from "xlsx";
import { logAudit } from "@/lib/services/audit";

interface ExcelRow {
  상품코드?: string;
  상품명?: string;
  바코드?: string;
  판매가?: number | string;
  공급가?: number | string;
  원가?: number | string;
  카테고리?: string;
  재고?: number | string;
  메모?: string;
}

interface ParsedProduct {
  row: number;
  code: string;
  name: string;
  barcode: string;
  sellPrice: number;
  supplyPrice: number;
  originalPrice: number;
  category: string;
  stock: number;
  notes: string;
  error?: string;
}

/**
 * POST /api/products/upload
 * 엑셀 파일 파싱 → 검증 → 센터 상품 일괄 등록
 * MASTER, SUB_MASTER, ADMIN만 가능
 */
export const POST = withRole(
  ["MASTER", "SUB_MASTER", "ADMIN"],
  async (req: NextRequest, user) => {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const centerId = formData.get("centerId") as string | null;

    if (!file) {
      return errors.badRequest("엑셀 파일을 업로드해주세요");
    }

    if (!centerId) {
      return errors.badRequest("센터를 선택해주세요");
    }

    // SUB_MASTER/ADMIN: 본인 센터만 업로드 가능
    if ((user.role === "SUB_MASTER" || user.role === "ADMIN") && user.centerId && centerId !== user.centerId) {
      return errors.forbidden("본인 센터의 상품만 업로드할 수 있습니다.");
    }

    // 센터 존재 확인
    const center = await prisma.center.findUnique({
      where: { id: centerId },
      select: { id: true, code: true, name: true },
    });

    if (!center) {
      return errors.notFound("센터");
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return errors.badRequest("엑셀 시트가 없습니다");
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return errors.badRequest("엑셀에 데이터가 없습니다");
    }

    if (rows.length > 500) {
      return errors.badRequest("한 번에 최대 500개까지 업로드할 수 있습니다");
    }

    // 1. 파싱 + 기본 검증
    const parsed: ParsedProduct[] = rows.map((row, idx) => {
      const code = String(row["상품코드"] ?? "").trim();
      const name = String(row["상품명"] ?? "").trim();
      const barcode = String(row["바코드"] ?? "").trim();
      const sellPrice = parseInt(String(row["판매가"] ?? "0")) || 0;
      const supplyPrice = parseInt(String(row["공급가"] ?? "0")) || 0;
      const originalPrice = parseInt(String(row["원가"] ?? "0")) || 0;
      const category = String(row["카테고리"] ?? "").trim();
      const stock = parseInt(String(row["재고"] ?? "0")) || 0;
      const notes = String(row["메모"] ?? "").trim();

      let error: string | undefined;
      if (!code) error = "상품코드 누락";
      else if (!name) error = "상품명 누락";
      else if (sellPrice < 0) error = "판매가 음수";
      else if (supplyPrice < 0) error = "공급가 음수";
      else if (originalPrice < 0) error = "원가 음수";

      return { row: idx + 2, code, name, barcode, sellPrice, supplyPrice, originalPrice, category, stock, notes, error };
    });

    // 기본 검증 에러 확인
    const basicErrors = parsed.filter((p) => p.error);
    if (basicErrors.length > 0) {
      return errors.badRequest("엑셀 데이터 오류", {
        errors: basicErrors.map((e) => ({
          row: e.row,
          code: e.code,
          error: e.error,
        })),
      });
    }

    // 2. 엑셀 내 중복 코드 검사
    const codes = parsed.map((p) => p.code);
    const codeDups = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (codeDups.length > 0) {
      return errors.badRequest("엑셀 내 중복 상품코드", {
        duplicates: [...new Set(codeDups)],
      });
    }

    // 3. DB에서 기존 코드/바코드 중복 검사
    const existingByCode = await prisma.product.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });

    if (existingByCode.length > 0) {
      return errors.badRequest("이미 존재하는 상품코드", {
        duplicates: existingByCode.map((p) => p.code),
      });
    }

    // 입력된 바코드 중복 검사 (빈 바코드 제외)
    const inputBarcodes = parsed
      .map((p) => p.barcode)
      .filter((b) => b.length > 0);

    if (inputBarcodes.length > 0) {
      const existingByBarcode = await prisma.product.findMany({
        where: { barcode: { in: inputBarcodes } },
        select: { barcode: true },
      });

      if (existingByBarcode.length > 0) {
        return errors.badRequest("이미 존재하는 바코드", {
          duplicates: existingByBarcode.map((p) => p.barcode),
        });
      }
    }

    // 4. 빈 바코드 자동 생성
    const emptyBarcodeCount = parsed.filter((p) => !p.barcode).length;
    let generatedBarcodes: string[] = [];

    if (emptyBarcodeCount > 0) {
      generatedBarcodes = await generateCenterBarcodes(center.code, emptyBarcodeCount);
    }

    let barcodeIdx = 0;
    const productsToCreate = parsed.map((p) => {
      const barcode = p.barcode || generatedBarcodes[barcodeIdx++];
      return {
        code: p.code,
        name: p.name,
        barcode,
        sellPrice: p.sellPrice,
        supplyPrice: p.supplyPrice,
        originalPrice: p.originalPrice || null,
        category: p.category || null,
        totalStock: p.stock,
        stockMujin: p.stock,
        productType: "CENTER" as const,
        managedBy: center.id,
        isWmsProduct: false,
        registeredBy: user.userId,
        notes: p.notes || null,
      };
    });

    // 5. 트랜잭션으로 일괄 등록
    const created = await prisma.$transaction(
      productsToCreate.map((data) =>
        prisma.product.create({ data })
      )
    );

    logAudit({
      userId: user.userId,
      userRole: user.role,
      userName: user.name,
      action: "IMPORT",
      entityType: "Product",
      entityName: `${center.name} 상품 일괄등록`,
      after: { count: created.length, centerId: center.id, centerName: center.name },
      description: `상품 일괄등록: ${created.length}개 (${center.name})`,
      request: req,
    });

    return ok({
      message: `${created.length}개 상품이 등록되었습니다`,
      count: created.length,
      products: created.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        barcode: p.barcode,
      })),
    });
  }
);
