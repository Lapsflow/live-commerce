/**
 * Solapi Notification Client
 * 카카오 알림톡 → LMS 폴백
 * NOTIFICATION_PROVIDER=solapi
 *
 * 필요 환경변수:
 *   SOLAPI_API_KEY
 *   SOLAPI_API_SECRET
 *   SOLAPI_SENDER_PHONE   (발신번호, 사전 등록 필수)
 *   SOLAPI_PFID            (카카오 채널 ID)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/db/prisma";
import { TEMPLATES } from "./templates";
import type {
  NotificationClient,
  NotificationPayload,
  NotificationResult,
} from "./types";

export class SolapiNotificationClient implements NotificationClient {
  private apiKey: string;
  private apiSecret: string;
  private senderPhone: string;
  private pfId: string;

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || "";
    this.apiSecret = process.env.SOLAPI_API_SECRET || "";
    this.senderPhone = process.env.SOLAPI_SENDER_PHONE || "";
    this.pfId = process.env.SOLAPI_PFID || "";

    if (!this.apiKey || !this.apiSecret) {
      console.warn("[SOLAPI] API credentials not configured");
    }
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const template = TEMPLATES[payload.type];
    const message = template.buildMessage(payload.variables);

    // 1차: 카카오 알림톡 시도
    let result = await this.sendAlimTalk(payload, template.templateId, message);

    // 2차: 알림톡 실패 → LMS 폴백
    if (!result.success) {
      console.warn(
        `[SOLAPI] AlimTalk failed for ${payload.type}, fallback to LMS`
      );
      result = await this.sendLms(payload, message);
    }

    // DB 로그 기록
    await this.logNotification(payload, result, message);

    // 둘 다 실패 → 관리자 알림 + 에러 로그
    if (!result.success) {
      console.error(`[SOLAPI] All channels failed for ${payload.type}`, {
        recipient: payload.recipient.phone,
        error: result.error,
      });
      // 관리자에게 장애 알림 (환경변수 기반)
      await this.alertAdmin(payload, result);
    }

    return result;
  }

  /** 카카오 알림톡 전송 */
  private async sendAlimTalk(
    payload: NotificationPayload,
    templateId: string,
    message: string
  ): Promise<NotificationResult> {
    try {
      // Turbopack ignores serverExternalPackages → eval hides from static analysis
      // eslint-disable-next-line no-eval
      const mod = eval('require')("solapi");
      const SolapiSDK = mod?.default || mod;
      const client = new SolapiSDK(this.apiKey, this.apiSecret);

      const res = await client.send({
        to: payload.recipient.phone,
        from: this.senderPhone,
        kakaoOptions: {
          pfId: this.pfId,
          templateId,
          variables: payload.variables,
        },
      });

      return {
        success: true,
        channel: "ALIMTALK",
        status: "SENT",
        messageId: res?.groupId || res?.messageId || undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        channel: "ALIMTALK",
        status: "FAILED",
        error: err.message || "AlimTalk send failed",
      };
    }
  }

  /** LMS 폴백 전송 */
  private async sendLms(
    payload: NotificationPayload,
    message: string
  ): Promise<NotificationResult> {
    try {
      // Turbopack ignores serverExternalPackages → eval hides from static analysis
      // eslint-disable-next-line no-eval
      const mod = eval('require')("solapi");
      const SolapiSDK = mod?.default || mod;
      const client = new SolapiSDK(this.apiKey, this.apiSecret);

      const res = await client.send({
        to: payload.recipient.phone,
        from: this.senderPhone,
        text: message,
        type: "LMS",
        subject: "[슈퍼무진]",
      });

      return {
        success: true,
        channel: "LMS",
        status: "SENT",
        messageId: res?.groupId || res?.messageId || undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        channel: "LMS",
        status: "FAILED",
        error: err.message || "LMS send failed",
      };
    }
  }

  /** 관리자에게 장애 알림 (AlimTalk+LMS 모두 실패 시) */
  private async alertAdmin(
    payload: NotificationPayload,
    failResult: NotificationResult
  ): Promise<void> {
    const adminPhone = process.env.ADMIN_ALERT_PHONE;
    if (!adminPhone) {
      console.warn("[SOLAPI] ADMIN_ALERT_PHONE not set, skipping admin alert");
      return;
    }
    try {
      // eslint-disable-next-line no-eval
      const mod = eval('require')("solapi");
      const SolapiSDK = mod?.default || mod;
      const client = new SolapiSDK(this.apiKey, this.apiSecret);
      await client.send({
        to: adminPhone,
        from: this.senderPhone,
        text:
          `[슈퍼무진 알림장애]\n` +
          `유형: ${payload.type}\n` +
          `수신자: ${payload.recipient.phone}\n` +
          `오류: ${failResult.error || "unknown"}\n` +
          `AlimTalk+LMS 모두 실패. 확인 필요.`,
        type: "LMS",
        subject: "[슈퍼무진] 알림 장애",
      });
      console.log("[SOLAPI] Admin alert sent to", adminPhone);
    } catch (err) {
      // 관리자 알림마저 실패하면 로그만 남김
      console.error("[SOLAPI] Admin alert also failed:", err);
    }
  }

  /** DB 로그 기록 */
  private async logNotification(
    payload: NotificationPayload,
    result: NotificationResult,
    message: string
  ): Promise<void> {
    try {
      await prisma.notificationLog.create({
        data: {
          type: payload.type,
          recipient: payload.recipient.phone,
          channel: result.channel,
          content: message,
          status: result.status,
          orderId: payload.orderId || null,
          broadcastId: payload.broadcastId || null,
        },
      });
    } catch (err) {
      console.error("[SOLAPI] DB log failed:", err);
    }
  }
}
