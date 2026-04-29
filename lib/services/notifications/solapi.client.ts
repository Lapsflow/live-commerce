/**
 * Solapi Notification Client — REST API 직접 호출
 * SDK 의존성 없음 (Node.js crypto + fetch 만 사용)
 *
 * NOTIFICATION_PROVIDER=solapi
 *
 * 필요 환경변수:
 *   SOLAPI_API_KEY        — Solapi 콘솔 API Key
 *   SOLAPI_API_SECRET     — Solapi 콘솔 API Secret
 *   SOLAPI_SENDER_PHONE   — 발신번호 (Solapi 사전 등록 필수)
 *   SOLAPI_PFID           — 카카오 채널 ID (알림톡용, 선택)
 *   ADMIN_ALERT_PHONE     — 장애 시 관리자 알림 번호 (선택)
 */

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { TEMPLATES } from "./templates";
import type {
  NotificationClient,
  NotificationPayload,
  NotificationResult,
} from "./types";

const SOLAPI_API_URL = "https://api.solapi.com/messages/v4/send-many";

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
    if (!this.senderPhone) {
      console.warn("[SOLAPI] Sender phone not configured");
    }
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const template = TEMPLATES[payload.type];
    const message = template.buildMessage(payload.variables);

    // 1차: PFID가 있으면 알림톡 시도
    let result: NotificationResult | null = null;
    if (this.pfId) {
      result = await this.sendAlimTalk(payload, template.templateId, message);
    }

    // 2차: 알림톡 미설정 또는 실패 → LMS
    if (!result || !result.success) {
      if (result) {
        console.warn(
          `[SOLAPI] AlimTalk failed for ${payload.type}, fallback to LMS`
        );
      }
      result = await this.sendLms(payload, message);
    }

    // DB 로그 기록
    await this.logNotification(payload, result, message);

    // 모두 실패 → 관리자 알림
    if (!result.success) {
      console.error(`[SOLAPI] All channels failed for ${payload.type}`, {
        recipient: payload.recipient.phone,
        error: result.error,
      });
      await this.alertAdmin(payload, result);
    }

    return result;
  }

  // ── HMAC-SHA256 인증 헤더 생성 ──

  private buildAuthHeader(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(date + salt)
      .digest("hex");

    return `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  // ── Solapi REST API 호출 ──

  private async callApi(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: Record<string, any>[]
  ): Promise<{ ok: boolean; groupId?: string; error?: string }> {
    try {
      const res = await fetch(SOLAPI_API_URL, {
        method: "POST",
        headers: {
          Authorization: this.buildAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      const body = await res.json();

      if (!res.ok) {
        return {
          ok: false,
          error: body?.errorMessage || body?.message || `HTTP ${res.status}`,
        };
      }

      // 부분 실패 체크 (failureCount > 0)
      if (body?.log?.[0]?.failureCount > 0 || body?.failureCount > 0) {
        return {
          ok: false,
          groupId: body?.groupId,
          error: `Partial failure: ${body?.log?.[0]?.failureCount || body?.failureCount} failed`,
        };
      }

      return { ok: true, groupId: body?.groupId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      return { ok: false, error: message };
    }
  }

  // ── 카카오 알림톡 ──

  private async sendAlimTalk(
    payload: NotificationPayload,
    templateId: string,
    message: string
  ): Promise<NotificationResult> {
    const apiResult = await this.callApi([
      {
        to: payload.recipient.phone,
        from: this.senderPhone,
        kakaoOptions: {
          pfId: this.pfId,
          templateId,
          variables: payload.variables,
        },
      },
    ]);

    return {
      success: apiResult.ok,
      channel: "ALIMTALK",
      status: apiResult.ok ? "SENT" : "FAILED",
      messageId: apiResult.groupId,
      error: apiResult.error,
    };
  }

  // ── LMS 전송 ──

  private async sendLms(
    payload: NotificationPayload,
    message: string
  ): Promise<NotificationResult> {
    const apiResult = await this.callApi([
      {
        to: payload.recipient.phone,
        from: this.senderPhone,
        text: message,
        type: "LMS",
        subject: "[슈퍼무진]",
      },
    ]);

    return {
      success: apiResult.ok,
      channel: "LMS",
      status: apiResult.ok ? "SENT" : "FAILED",
      messageId: apiResult.groupId,
      error: apiResult.error,
    };
  }

  // ── 관리자 장애 알림 ──

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
      await this.callApi([
        {
          to: adminPhone,
          from: this.senderPhone,
          text:
            `[슈퍼무진 알림장애]\n` +
            `유형: ${payload.type}\n` +
            `수신자: ${payload.recipient.phone}\n` +
            `오류: ${failResult.error || "unknown"}\n` +
            `확인 필요.`,
          type: "LMS",
          subject: "[슈퍼무진] 알림 장애",
        },
      ]);
      console.log("[SOLAPI] Admin alert sent to", adminPhone);
    } catch (err) {
      console.error("[SOLAPI] Admin alert also failed:", err);
    }
  }

  // ── DB 로그 ──

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
