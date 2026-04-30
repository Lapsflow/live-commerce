/**
 * Notification Service Types
 * 알림 시스템 공통 인터페이스
 */

// ── Notification Types ──

export type NotificationType =
  | "ORDER_CONFIRMED"        // ORDER-05: 가상계좌 발급 → 셀러
  | "ORDER_VA_FAILED"        // ORDER-05: 가상계좌 발급 실패 → 셀러+관리자
  | "ORDER_SHIPPED"          // ORDER-06: 출고완료 → 셀러
  | "BROADCAST_REQUESTED"    // LIVE-09: 셀러 요청접수 → 센터담당자
  | "BROADCAST_APPROVED"     // LIVE-09: 방송 승인
  | "BROADCAST_REJECTED"     // LIVE-09: 방송 반려 → 셀러
  | "BROADCAST_CANCELED"     // LIVE-09: 방송 취소
  | "BROADCAST_REMINDER"     // LIVE-09: 방송 당일 일괄 리마인더 (07시)
  | "BROADCAST_REMINDER_1H"  // LIVE-09: 방송 1시간 전 정밀 리마인더 (매시간 cron)
  | "BROADCAST_STARTED"      // LIVE-09: 방송 시작됨
  | "BROADCAST_ENDED"        // LIVE-09: 방송 종료됨
  | "SAMPLE_CHECKOUT"        // PROPOSAL-09: 샘플 결제 완료
  ;

export type NotificationChannel = "ALIMTALK" | "LMS" | "SMS" | "EMAIL";

export type NotificationStatus = "SENT" | "FAILED" | "MOCK";

// ── Payload ──

export interface NotificationPayload {
  type: NotificationType;
  recipient: {
    name: string;
    phone: string;
    email?: string;
  };
  /** 알림톡 템플릿 변수 */
  variables: Record<string, string>;
  /** 연관 엔티티 ID */
  orderId?: string;
  broadcastId?: string;
}

// ── Result ──

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  status: NotificationStatus;
  messageId?: string;
  error?: string;
}

// ── Client Interface ──

export interface NotificationClient {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
