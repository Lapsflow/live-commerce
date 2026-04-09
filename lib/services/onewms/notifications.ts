/**
 * ONEWMS Notification Service (Placeholder)
 * TODO: Integrate with SendGrid or AWS SES for production
 */

interface NotificationData {
  type: 'order_shipped' | 'delivery_completed' | 'delivery_failed';
  recipient: {
    name: string;
    phone: string;
  };
  orderNo: string;
  transNo?: string;
  error?: string;
}

/**
 * Send notification to customer
 * Currently logs to console - integrate with email service for production
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  console.log('📧 Notification:', {
    type: data.type,
    recipient: data.recipient.name,
    orderNo: data.orderNo,
    transNo: data.transNo,
  });

  // TODO: Implement actual email sending
  // Example with SendGrid:
  /*
  import sgMail from '@sendgrid/mail';

  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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
        <p>사유: ${data.error}</p>
        <p>고객센터로 문의 부탁드립니다.</p>
      `,
    },
  };

  const template = templates[data.type];

  await sgMail.send({
    to: data.recipient.email, // Need to add email field
    from: process.env.NOTIFICATION_FROM_EMAIL!,
    subject: template.subject,
    html: template.html,
  });
  */

  // For now, just log
  const messages = {
    order_shipped: `📦 주문 ${data.orderNo} 출고완료 (송장: ${data.transNo})`,
    delivery_completed: `✅ 주문 ${data.orderNo} 배송완료`,
    delivery_failed: `❌ 주문 ${data.orderNo} 배송실패: ${data.error}`,
  };

  console.log(`[Notification] ${messages[data.type]}`);
}
