/**
 * POST /api/payments/create-virtual-account
 * Create virtual account for order payment via Toss Payments
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { sendNotification as sendOnewmsNotification } from '@/lib/services/onewms/notifications';
import { sendNotification } from '@/lib/services/notifications';

const TOSS_API_URL = 'https://api.tosspayments.com/v1/virtual-accounts';
const VALID_HOURS = 3; // 3시간 유효

interface TossVirtualAccountRequest {
  amount: number;
  orderId: string;
  orderName: string;
  customerName: string;
  validHours: number;
  cashReceipt?: {
    type: '소득공제' | '지출증빙';
  };
  bank: string; // 'KB' | '신한' | '우리' | 'IBK' | 'NH' | '하나' 등
  customerMobilePhone?: string;
}

interface TossVirtualAccountResponse {
  accountNumber: string;
  bank: string;
  bankCode: string;
  customerName: string;
  dueDate: string;
  expired: boolean;
  orderId: string;
  orderName: string;
  secret: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errors.unauthorized();
    }

    const body = await req.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string') {
      return errors.badRequest('orderId 필드가 필요합니다');
    }

    // Fetch order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (!order) {
      return errors.notFound('발주를 찾을 수 없습니다');
    }

    // Verify user is the seller or admin
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    if (order.sellerId !== userId && !['MASTER', 'SUB_MASTER', 'ADMIN'].includes(userRole)) {
      return errors.forbidden('발주에 대한 권한이 없습니다');
    }

    // Check if virtual account already exists
    if (order.virtualAccount) {
      return errors.badRequest('이미 가상계좌가 발급된 발주입니다');
    }

    // Check Toss Payments secret key
    const tossSecretKey = process.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      console.error('[Virtual Account] TOSS_SECRET_KEY not configured');
      return errors.internal('결제 시스템이 설정되지 않았습니다');
    }

    // Prepare Toss Payments request
    const tossRequest: TossVirtualAccountRequest = {
      amount: order.totalAmount,
      orderId: order.id,
      orderName: `발주 ${order.orderNo}`,
      customerName: order.seller.name || order.seller.email || "고객",
      validHours: VALID_HOURS,
      cashReceipt: {
        type: '소득공제',
      },
      bank: 'KB', // 국민은행 (기본값)
      customerMobilePhone: order.phone || undefined,
    };

    // Call Toss Payments API
    const authHeader = `Basic ${Buffer.from(`${tossSecretKey}:`).toString('base64')}`;

    const response = await fetch(TOSS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tossRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[Virtual Account] Toss API error:', errorData);

      const errorMessage = errorData?.message || '가상계좌 발급에 실패했습니다';

      // Order 상태를 PAYMENT_FAILED로 변경
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAYMENT_FAILED" },
      }).catch((err) => console.error("[VA_FAIL_STATUS_UPDATE]", err));

      // 셀러에게 실패 알림
      if (order.seller.phone) {
        sendNotification({
          type: "ORDER_VA_FAILED",
          recipient: {
            name: order.seller.name,
            phone: order.seller.phone,
            email: order.seller.email || undefined,
          },
          variables: {
            orderCode: order.orderNo,
            errorMessage,
          },
          orderId,
        }).catch((err) => console.error("[VA_FAIL_NOTIFICATION]", err));
      }

      // 관리자에게도 알림
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["MASTER", "SUB_MASTER"] }, isActive: true },
          select: { name: true, phone: true, email: true },
        });
        for (const admin of admins) {
          if (admin.phone) {
            sendNotification({
              type: "ORDER_VA_FAILED",
              recipient: { name: admin.name, phone: admin.phone, email: admin.email || undefined },
              variables: { orderCode: order.orderNo, errorMessage: `[관리자용] ${errorMessage}` },
              orderId,
            }).catch((err) => console.error("[VA_FAIL_ADMIN_NOTIF]", err));
          }
        }
      } catch (notifErr) {
        console.error("[VA_FAIL_ADMIN_NOTIF]", notifErr);
      }

      return errors.internal(errorMessage);
    }

    const tossResponse: TossVirtualAccountResponse = await response.json();

    // Calculate expiry time
    const expiryTime = new Date(Date.now() + VALID_HOURS * 60 * 60 * 1000);

    // Update order with virtual account info
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        virtualAccount: tossResponse.accountNumber,
        virtualAccountBank: tossResponse.bank,
        virtualAccountExpiry: expiryTime,
      },
    });

    console.log(
      `[Virtual Account] Created for order ${order.orderNo}:`,
      `${tossResponse.bank} ${tossResponse.accountNumber}`
    );

    // Send deposit notification to seller (legacy email)
    await sendOnewmsNotification({
      type: 'deposit_request',
      recipient: {
        name: order.seller.name,
        phone: order.seller.phone ?? 'N/A',
        email: order.seller.email || undefined,
      },
      orderNo: order.orderNo,
      depositInfo: {
        bank: tossResponse.bank,
        accountNumber: tossResponse.accountNumber,
        amount: order.totalAmount,
        expiryHours: VALID_HOURS,
      },
    });

    // ORDER-05: 가상계좌 발급 알림 → 셀러 (AlimTalk/LMS)
    if (order.seller.phone) {
      sendNotification({
        type: "ORDER_CONFIRMED",
        recipient: {
          name: order.seller.name,
          phone: order.seller.phone,
          email: order.seller.email || undefined,
        },
        variables: {
          orderCode: order.orderNo,
          amount: order.totalAmount.toLocaleString(),
          bank: tossResponse.bank,
          accountNumber: tossResponse.accountNumber,
          expiryAt: expiryTime.toLocaleString("ko-KR"),
        },
        orderId,
      }).catch((err) => console.error("[VA_NOTIFICATION]", err));
    }

    return ok({
      accountNumber: tossResponse.accountNumber,
      bank: tossResponse.bank,
      bankCode: tossResponse.bankCode,
      amount: order.totalAmount,
      expiryAt: expiryTime,
      orderNo: order.orderNo,
      validHours: VALID_HOURS,
    });
  } catch (error) {
    console.error('[Virtual Account] Failed to create virtual account:', error);
    const message = error instanceof Error ? error.message : '가상계좌 발급 중 오류가 발생했습니다';

    // 가능한 경우 orderId 기반 상태 업데이트 + 알림
    try {
      const body2 = await req.clone().json().catch(() => null);
      const failOrderId = body2?.orderId;
      if (failOrderId) {
        await prisma.order.update({
          where: { id: failOrderId },
          data: { paymentStatus: "PAYMENT_FAILED" },
        });
        const failOrder = await prisma.order.findUnique({
          where: { id: failOrderId },
          include: { seller: { select: { name: true, phone: true, email: true } } },
        });
        if (failOrder?.seller?.phone) {
          await sendNotification({
            type: "ORDER_VA_FAILED",
            recipient: {
              name: failOrder.seller.name,
              phone: failOrder.seller.phone,
              email: failOrder.seller.email || undefined,
            },
            variables: { orderCode: failOrder.orderNo, errorMessage: message },
            orderId: failOrderId,
          });
        }
      }
    } catch (notifErr) {
      console.error("[VA_CATCH_NOTIFICATION]", notifErr);
    }

    return errors.internal(message);
  }
}
