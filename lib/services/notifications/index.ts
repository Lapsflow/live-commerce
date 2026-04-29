/**
 * Notification Service
 * 환경변수 기반 클라이언트 자동 선택
 *
 * NOTIFICATION_PROVIDER=solapi → SolapiNotificationClient (REST API)
 * NOTIFICATION_PROVIDER=mock (또는 미설정) → MockNotificationClient
 */

import type { NotificationClient, NotificationPayload, NotificationResult } from "./types";
import { MockNotificationClient } from "./mock.client";
import { SolapiNotificationClient } from "./solapi.client";

let _client: NotificationClient | undefined;

function getClient(): NotificationClient {
  if (_client) return _client;

  const provider = process.env.NOTIFICATION_PROVIDER || "mock";

  if (provider === "solapi") {
    _client = new SolapiNotificationClient();
    console.log("[Notification] Using Solapi provider (REST API)");
  } else {
    _client = new MockNotificationClient();
    console.log("[Notification] Using Mock provider");
  }

  return _client;
}

/**
 * 알림 전송 (비동기, 실패해도 호출자에 영향 없음)
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  try {
    const client = getClient();
    return await client.send(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Notification] Unexpected error:", message);
    return {
      success: false,
      channel: "LMS",
      status: "FAILED",
      error: message,
    };
  }
}

// Re-export types
export type { NotificationPayload, NotificationResult, NotificationClient };
export type { NotificationType, NotificationChannel, NotificationStatus } from "./types";
