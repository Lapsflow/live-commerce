import { NextRequest } from "next/server";
import * as xlsx from "xlsx";

/**
 * GET /api/orders/template
 *
 * Excel 템플릿 다운로드
 */
export async function GET(req: NextRequest) {
  // 샘플 데이터
  // 운영 검증(2026-05-26): 메모 셀에 "비고 (선택)" placeholder 값이 그대로 ONEWMS 로
  //   전송되어 메모란에 의미없는 텍스트가 계속 표시되는 버그 발견. 빈 값으로 변경.
  //   ONEWMS 화면에서 메모가 정말 비어있게 표시되도록 함. (보강: bulk/route.ts 에서도
  //   placeholder 검출 fallback 추가)
  const template = [
    {
      '주문번호': '',  // 자동 생성됨
      '수령자': '홍길동',
      '연락처': '010-1234-5678',
      '주소': '서울시 강남구 테헤란로 123',
      '상품코드': '[33]',  // ORDER-01: [숫자] 또는 [Cxx-xxx] 코드
      '바코드': '1234567890123',
      '상품명': '샘플 상품',
      '수량': 10,
      '입금액': 100000,
      '메모': '',  // 비워두면 ONEWMS 에 메모 미전송. 필요 시 실제 메모 직접 입력.
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
