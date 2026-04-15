/**
 * ONEWMS Notification Service
 * Sends email notifications using SendGrid
 */

interface NotificationData {
  type: 'order_shipped' | 'delivery_completed' | 'delivery_failed' | 'deposit_request';
  recipient: {
    name: string;
    phone: string;
    email?: string; // Optional: email address for notifications
  };
  orderNo: string;
  transNo?: string;
  error?: string;
  // Deposit-specific fields
  depositInfo?: {
    bank: string;
    accountNumber: string;
    amount: number;
    expiryHours: number;
  };
}

/**
 * Send notification to customer via email
 * Falls back to console log if email is not configured or available
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  console.log('📧 Notification:', {
    type: data.type,
    recipient: data.recipient.name,
    orderNo: data.orderNo,
    transNo: data.transNo,
  });

  // If no email provided, skip email sending (SMS-only scenario)
  if (!data.recipient.email) {
    console.warn('⚠️ No email provided for notification, skipping email send');
    logNotification(data);
    return;
  }

  // If SendGrid is not configured, fall back to console logging
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️ SENDGRID_API_KEY not configured, skipping email send');
    logNotification(data);
    return;
  }

  // Send email using SendGrid
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const templates = {
      order_shipped: {
        subject: '[라이브커머스] 주문이 출고되었습니다',
        html: `
          <h2>안녕하세요 ${data.recipient.name}님,</h2>
          <p>주문번호 <strong>${data.orderNo}</strong>가 출고되었습니다.</p>
          <p>송장번호: <strong>${data.transNo}</strong></p>
          <p>배송 조회는 택배사 홈페이지에서 확인하실 수 있습니다.</p>
        `,
      },
      delivery_completed: {
        subject: '[라이브커머스] 배송이 완료되었습니다',
        html: `
          <h2>안녕하세요 ${data.recipient.name}님,</h2>
          <p>주문번호 <strong>${data.orderNo}</strong>의 배송이 완료되었습니다.</p>
          <p>이용해 주셔서 감사합니다.</p>
        `,
      },
      delivery_failed: {
        subject: '[라이브커머스] 배송 실패 안내',
        html: `
          <h2>안녕하세요 ${data.recipient.name}님,</h2>
          <p>주문번호 <strong>${data.orderNo}</strong>의 배송 중 문제가 발생했습니다.</p>
          <p>사유: ${data.error || '알 수 없는 오류'}</p>
          <p>고객센터로 문의 부탁드립니다.</p>
        `,
      },
      deposit_request: {
        subject: '[라이브커머스] 입금 안내 - 가상계좌 발급',
        html: `
          <h2>안녕하세요 ${data.recipient.name}님,</h2>
          <p>주문번호 <strong>${data.orderNo}</strong>의 가상계좌가 발급되었습니다.</p>
          <p><strong>입금 정보:</strong></p>
          <ul>
            <li>은행: <strong>${data.depositInfo?.bank || ''}</strong></li>
            <li>계좌번호: <strong>${data.depositInfo?.accountNumber || ''}</strong></li>
            <li>입금액: <strong>${(data.depositInfo?.amount || 0).toLocaleString()}원</strong></li>
            <li>입금 마감: <strong>${data.depositInfo?.expiryHours || 3}시간 이내</strong></li>
          </ul>
          <p style="color: red;"><strong>⚠️ 주의:</strong> ${data.depositInfo?.expiryHours || 3}시간 이내 미입금 시 자동 취소됩니다.</p>
        `,
      },
    };

    const template = templates[data.type];

    await sgMail.send({
      to: data.recipient.email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourstore.com',
      subject: template.subject,
      html: template.html,
    });

    console.log(`✅ Email sent successfully: ${data.type} to ${data.recipient.email}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    // Don't throw - notification failure shouldn't break the main flow
    logNotification(data);
  }
}

/**
 * Log notification to console as fallback
 */
function logNotification(data: NotificationData): void {
  const messages = {
    order_shipped: `📦 주문 ${data.orderNo} 출고완료 (송장: ${data.transNo})`,
    delivery_completed: `✅ 주문 ${data.orderNo} 배송완료`,
    delivery_failed: `❌ 주문 ${data.orderNo} 배송실패: ${data.error}`,
    deposit_request: `💰 주문 ${data.orderNo} 입금요청 (${data.depositInfo?.bank} ${data.depositInfo?.accountNumber}, ${(data.depositInfo?.amount || 0).toLocaleString()}원)`,
  };

  console.log(`[Notification] ${messages[data.type]}`);
}
