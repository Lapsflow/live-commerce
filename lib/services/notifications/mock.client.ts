/**
 * Mock Notification Client
 * console.log + NotificationLog DB 기록
 * NOTIFICATION_PROVIDER=mock (기본값)
 */

import { prisma } from "@/lib/db/prisma";
import { TEMPLATES } from "./templates";
import type {
  NotificationClient,
  NotificationPayload,
  NotificationResult,
} from "./types";

export class MockNotificationClient implements NotificationClient {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const template = TEMPLATES[payload.type];
    const message = template.buildMessage(payload.variables);

    // Console 출력
    console.log(`[MOCK_NOTIFICATION] ${payload.type}`, {
      recipient: payload.recipient.name,
      phone: payload.recipient.phone,
      message,
    });

    // DB 로그 기록
    try {
      await prisma.notificationLog.create({
        data: {
          type: payload.type,
          recipient: payload.recipient.phone,
          channel: "ALIMTALK",
          content: message,
          status: "MOCK",
          orderId: payload.orderId || null,
          broadcastId: payload.broadcastId || null,
        },
      });
    } catch (err) {
      console.error("[MOCK_NOTIFICATION] DB log failed:", err);
    }

    return {
      success: true,
      channel: "ALIMTALK",
      status: "MOCK",
      messageId: `mock_${Date.now()}`,
    };
  }
}
