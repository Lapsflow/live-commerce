/**
 * POST /api/products/upload/preview
 * 엑셀 업로드 Dry Run — DB 변경 없이 변경 사항 미리보기
 */

import { NextRequest } from "next/server";
import { withRole } from "@/lib/api/middleware";
import { ok, errors } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import * as XLSX from "xlsx";
import { parseAndValidateExcel, buildUpsertPlan } from "@/lib/services/products/excelUpsert";

export const POST = withRole(
  ["MASTER", "SUB_MASTER"],
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

    // SUB_MASTER: 본인 센터만
    if (user.role === "SUB_MASTER" && user.centerId && centerId !== user.centerId) {
      return errors.forbidden("본인 센터의 상품만 업로드할 수 있습니다.");
    }

    // 센터 존재 확인
    const center = await prisma.center.findUnique({
      where: { id: centerId },
      select: { id: true },
    });

    if (!center) {
      return errors.notFound("센터");
    }

    // 파일 파싱
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return errors.badRequest("엑셀 시트가 없습니다");
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

    if (rawRows.length === 0) {
      return errors.badRequest("엑셀에 데이터가 없습니다");
    }

    if (rawRows.length > 500) {
      return errors.badRequest("한 번에 최대 500개까지 업로드할 수 있습니다");
    }

    // 검증
    const { valid, errors: validationErrors } = parseAndValidateExcel(rawRows);

    if (validationErrors.length > 0) {
      return errors.badRequest("엑셀 데이터 오류", { errors: validationErrors });
    }

    // Dry Run
    const preview = await buildUpsertPlan(centerId, valid);

    if (preview.validationErrors.length > 0) {
      return errors.badRequest("바코드 충돌", { errors: preview.validationErrors });
    }

    return ok(preview);
  }
);
