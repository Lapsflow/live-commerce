import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/api/middleware';
import { ok, errors } from '@/lib/api/response';
import { syncOrderDeliveryStatus } from '@/lib/services/onewms/deliverySync';

const deliveryUpdateSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * POST /api/onewms/delivery/update
 * 특정 주문의 배송 상태를 ONEWMS에서 수동으로 동기화
 */
export const POST = withRole(
  ['ADMIN', 'SUB_MASTER', 'MASTER'],
  async (req: NextRequest) => {
    try {
      // 요청 본문 파싱 및 검증
      const body = await req.json();
      const validation = deliveryUpdateSchema.safeParse(body);

      if (!validation.success) {
        return errors.badRequest(
          '유효하지 않은 요청',
          validation.error.format()
        );
      }

      const { orderId } = validation.data;

      // 배송 상태 동기화 실행
      const result = await syncOrderDeliveryStatus(orderId);

      if (!result.success) {
        return errors.badRequest(result.error || '배송 상태 동기화 실패');
      }

      return ok({
        updated: result.updated,
        message: result.updated
          ? '배송 상태가 업데이트되었습니다'
          : '배송 상태 변경 없음',
      });
    } catch (error: any) {
      console.error('Delivery update failed:', error);
      return errors.internal('배송 상태 업데이트 실패');
    }
  }
);
