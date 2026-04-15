/**
 * POST /api/webhooks/toss/virtual-account
 * Toss Payments webhook for virtual account payment confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { syncOrderToOnewms } from '@/lib/services/onewms/orderSync';
import { recordSellerProductMatch } from '@/lib/services/analytics/sellerProductMatching';
import crypto from 'crypto';

interface TossWebhookPayload {
  eventType: string; // 'VirtualAccountPaymentConfirmed' 등
  orderId: string;
  status: string; // 'DONE', 'IN_PROGRESS', 'WAITING_FOR_DEPOSIT', etc.
  secret: string;
  virtualAccount?: {
    accountNumber: string;
    bank: string;
    bankCode: string;
    customerName: string;
    settlementStatus: string;
  };
  transaction?: {
    transactionAt: string;
  };
}

/**
 * Verify Toss webhook signature using HMAC-SHA256
 */
function verifyTossSignature(
  signature: string | null,
  body: TossWebhookPayload
): boolean {
  if (!signature) return false;
  if (!process.env.TOSS_SECRET_KEY) {
    console.warn('[Toss Webhook] TOSS_SECRET_KEY not configured, skipping signature verification');
    return true; // Allow in development mode
  }

  try {
    // Toss uses orderId + secret as the message to sign
    const message = body.orderId + body.secret;
    const hmac = crypto.createHmac('sha256', process.env.TOSS_SECRET_KEY);
    hmac.update(message);
    const expectedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Toss Webhook] Signature verification error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: TossWebhookPayload = await req.json();

    console.log('[Toss Webhook] Received payment notification:', {
      eventType: body.eventType,
      orderId: body.orderId,
      status: body.status,
    });

    // Verify webhook signature for security
    const signature = req.headers.get('toss-signature');
    if (!verifyTossSignature(signature, body)) {
      console.error('[Toss Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Check if payment is completed
    if (body.status !== 'DONE') {
      console.log(`[Toss Webhook] Payment not completed yet: ${body.status}`);
      return NextResponse.json({
        success: true,
        message: 'Webhook received, payment not completed',
      });
    }

    const orderId = body.orderId;

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Find order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          seller: true,
        },
      });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Check if already paid
      if (order.paymentStatus === 'PAID') {
        console.log(`[Toss Webhook] Order ${order.orderNo} already marked as PAID`);
        return { alreadyPaid: true, order };
      }

      // Update order to PAID status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paidAt: new Date(),
          status: order.status === 'PENDING' ? 'APPROVED' : order.status, // Auto-approve if pending
        },
      });

      console.log(`[Toss Webhook] Order ${order.orderNo} marked as PAID`);

      return { alreadyPaid: false, order: updatedOrder };
    });

    // Trigger ONEWMS auto-ordering and seller-product matching (outside transaction to avoid blocking)
    if (!result.alreadyPaid) {
      // ONEWMS auto-order
      try {
        console.log(`[Toss Webhook] Triggering ONEWMS auto-order for ${result.order.orderNo}`);
        await syncOrderToOnewms(orderId);
        console.log(`[Toss Webhook] ONEWMS auto-order successful for ${result.order.orderNo}`);
      } catch (onewmsError) {
        // Log error but don't fail the webhook
        // Payment was successful even if ONEWMS sync fails
        console.error(
          `[Toss Webhook] ONEWMS auto-order failed for ${result.order.orderNo}:`,
          onewmsError
        );
      }

      // Record seller-product matching
      try {
        console.log(`[Toss Webhook] Recording seller-product matching for ${result.order.orderNo}`);
        await recordSellerProductMatch(orderId);
        console.log(`[Toss Webhook] Seller-product matching successful for ${result.order.orderNo}`);
      } catch (matchingError) {
        // Log error but don't fail the webhook
        console.error(
          `[Toss Webhook] Seller-product matching failed for ${result.order.orderNo}:`,
          matchingError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: result.alreadyPaid ? 'Already paid' : 'Payment confirmed and processed',
      orderId,
      orderNo: result.order.orderNo,
    });
  } catch (error) {
    console.error('[Toss Webhook] Failed to process webhook:', error);

    const message = error instanceof Error ? error.message : 'Webhook processing failed';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
