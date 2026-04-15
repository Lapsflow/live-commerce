/**
 * POST /api/payments/create-virtual-account
 * Create virtual account for order payment via Toss Payments
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ok, errors } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { sendNotification } from '@/lib/services/onewms/notifications';

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
      customerName: order.seller.name || order.seller.email,
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

    // Send deposit notification to seller
    await sendNotification({
      type: 'deposit_request',
      recipient: {
        name: order.seller.name,
        phone: order.seller.phone ?? 'N/A',
        email: order.seller.email,
      },
      orderNo: order.orderNo,
      depositInfo: {
        bank: tossResponse.bank,
        accountNumber: tossResponse.accountNumber,
        amount: order.totalAmount,
        expiryHours: VALID_HOURS,
      },
    });

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

    if (error instanceof Error) {
      return errors.internal(error.message);
    }

    return errors.internal('가상계좌 발급 중 오류가 발생했습니다');
  }
}
