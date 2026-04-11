import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { createOnewmsClient } from '@/lib/onewms';

/**
 * GET /api/onewms/delivery/invoice/[transNo]
 * ONEWMS에서 송장 이미지 URL 조회 (고객 서비스 및 배송 확인용)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transNo: string }> }
) {
  try {
    // 인증 확인
    const session = await auth();
    if (!session) {
      return errors.unauthorized();
    }

    const { transNo } = await params;

    if (!transNo) {
      return errors.badRequest('송장번호가 필요합니다');
    }

    // ONEWMS에서 송장 이미지 URL 조회
    const client = createOnewmsClient();
    const invoiceUrl = await client.getTransportInvoice(transNo);

    if (!invoiceUrl) {
      return errors.notFound('송장 이미지');
    }

    return ok({
      transNo,
      invoiceUrl,
    });
  } catch (error: any) {
    console.error('Failed to fetch invoice:', error);
    return errors.internal('송장 이미지 조회 실패');
  }
}
