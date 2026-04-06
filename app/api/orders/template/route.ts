import { NextRequest } from "next/server";
import * as xlsx from "xlsx";

/**
 * GET /api/orders/template
 *
 * Excel 템플릿 다운로드
 */
export async function GET(req: NextRequest) {
  // 샘플 데이터
  const template = [
    {
      '주문번호': '',  // 자동 생성됨
      '수령자': '홍길동',
      '연락처': '010-1234-5678',
      '주소': '서울시 강남구 테헤란로 123',
      '바코드': '1234567890123',
      '상품명': '샘플 상품',
      '수량': 10,
      '입금액': 100000,
      '메모': '비고 (선택)',
    },
  ];

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(template);
  xlsx.utils.book_append_sheet(wb, ws, "발주 템플릿");

  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=order-template.xlsx",
    },
  });
}
