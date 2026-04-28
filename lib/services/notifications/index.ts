/**
 * Notification Service
 * 환경변수 기반 클라이언트 자동 선택
 *
 * NOTIFICATION_PROVIDER=solapi → SolapiNotificationClient
 * NOTIFICATION_PROVIDER=mock (또는 미설정) → MockNotificationClient
 */

import type { NotificationClient, NotificationPayload, NotificationResult } from "./types";
import { MockNotificationClient } from "./mock.client";

let _client: NotificationClient | undefined;

function getClient(): NotificationClient {
  if (_client) return _client;

  const provider = process.env.NOTIFICATION_PROVIDER || "mock";

  if (provider === "solapi") {
    // Dynamic path to prevent bundler from tracing uninstalled SDK
    const modPath = `./${provider}.client`;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modPath);
    _client = new mod.SolapiNotificationClient();
    console.log("[Notification] Using Solapi provider");
  } else {
    _client = new MockNotificationClient();
    console.log("[Notification] Using Mock provider");
  }

  return _client!;
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
  } catch (err: any) {
    console.error("[Notification] Unexpected error:", err);
    return {
      success: false,
      channel: "ALIMTALK",
      status: "FAILED",
      error: err.message,
    };
  }
}

// Re-export types
export type { NotificationPayload, NotificationResult, NotificationClient };
export type { NotificationType, NotificationChannel, NotificationStatus } from "./types";
