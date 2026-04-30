/**
 * Notification Templates
 * 카카오 알림톡 템플릿 + LMS 폴백 메시지
 */

import type { NotificationType } from "./types";

interface Template {
  /** 카카오 알림톡 템플릿 코드 (Solapi 등록 후 발급) */
  templateId: string;
  /** LMS 폴백 메시지 생성 함수 */
  buildMessage: (vars: Record<string, string>) => string;
  /** 설명 */
  description: string;
}

/**
 * 템플릿 맵
 * templateId는 Solapi 콘솔에서 등록 후 실제 값으로 교체 필요
 */
export const TEMPLATES: Record<NotificationType, Template> = {
  // ── ORDER-05: 가상계좌 발급 → 셀러 ──
  ORDER_CONFIRMED: {
    templateId: "TPL_ORDER_CONFIRMED",
    description: "가상계좌 발급 안내 → 셀러",
    buildMessage: (v) =>
      `[슈퍼무진] 가상계좌 발급 안내\n\n` +
      `주문번호: ${v.orderCode || "-"}\n` +
      `금액: ${v.amount || "-"}원\n` +
      `은행: ${v.bank || "-"}\n` +
      `계좌번호: ${v.accountNumber || "-"}\n` +
      `입금기한: ${v.expiryAt || "-"}\n` +
      `기한 내 입금해 주세요.`,
  },

  // ── ORDER-05: 가상계좌 발급 실패 → 셀러+관리자 ──
  ORDER_VA_FAILED: {
    templateId: "TPL_ORDER_VA_FAILED",
    description: "가상계좌 발급 실패 알림 → 셀러/관리자",
    buildMessage: (v) =>
      `[슈퍼무진] 발주 처리 오류\n\n` +
      `주문번호: ${v.orderCode || "-"}\n` +
      `사유: ${v.errorMessage || "시스템 오류"}\n` +
      `담당자에게 문의해 주세요.`,
  },

  // ── ORDER-06: 출고완료 → 셀러 ──
  ORDER_SHIPPED: {
    templateId: "TPL_ORDER_SHIPPED",
    description: "출고완료 알림 → 셀러",
    buildMessage: (v) =>
      `[슈퍼무진] 출고 완료 안내\n\n` +
      `주문번호: ${v.orderCode || "-"}\n` +
      `출고가 완료되었습니다.`,
  },

  // ── LIVE-09: 셀러 요청접수 → 센터담당자 ──
  BROADCAST_REQUESTED: {
    templateId: "TPL_BROADCAST_REQUESTED",
    description: "방송 요청 접수 알림 → 관리자",
    buildMessage: (v) =>
      `[슈퍼무진] 방송 요청 접수\n\n` +
      `셀러: ${v.sellerName || "-"}\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `희망일시: ${v.scheduledAt || "-"}\n` +
      `방송 승인을 검토해 주세요.`,
  },

  // ── LIVE-09: 방송 승인 ──
  BROADCAST_APPROVED: {
    templateId: "TPL_BROADCAST_APPROVED",
    description: "방송 승인 알림 → 셀러",
    buildMessage: (v) =>
      `[슈퍼무진] 방송 승인 안내\n\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `일시: ${v.scheduledAt || "-"}\n` +
      `방송이 승인되었습니다. 준비를 진행해 주세요.`,
  },

  // ── LIVE-09: 방송 취소 ──
  BROADCAST_CANCELED: {
    templateId: "TPL_BROADCAST_CANCELED",
    description: "방송 취소 알림 → 셀러",
    buildMessage: (v) =>
      `[슈퍼무진] 방송 취소 안내\n\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `취소 사유: ${v.cancelReason || "사유 없음"}\n` +
      `방송이 취소되었습니다.`,
  },

  // ── LIVE-09: 방송 당일 일괄 리마인더 (07시 KST) ──
  BROADCAST_REMINDER: {
    templateId: "TPL_BROADCAST_REMINDER",
    description: "방송 당일 일괄 리마인더 → 셀러",
    buildMessage: (v) =>
      `[슈퍼무진] 오늘 방송 안내\n\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `시작 시각: ${v.scheduledAt || "-"}\n` +
      `오늘 방송이 예정되어 있습니다. 준비해 주세요.`,
  },

  // ── LIVE-09: 방송 1시간 전 정밀 리마인더 (매시간 cron) ──
  BROADCAST_REMINDER_1H: {
    templateId: "TPL_BROADCAST_REMINDER_1H",
    description: "방송 1시간 전 리마인더 → 셀러 (스펙 421번 줄)",
    buildMessage: (v) =>
      `[슈퍼무진] 방송 임박 안내\n\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `시작 시각: ${v.scheduledAt || "-"}\n` +
      `약 1시간 후 방송이 시작됩니다. 최종 준비를 확인해 주세요.`,
  },

  // ── LIVE-09: 방송 시작됨 ──
  BROADCAST_STARTED: {
    templateId: "TPL_BROADCAST_STARTED",
    description: "방송 시작 알림 → 관리자",
    buildMessage: (v) =>
      `[슈퍼무진] 방송 시작\n\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `셀러: ${v.sellerName || "-"}\n` +
      `방송이 시작되었습니다.`,
  },

  // ── LIVE-09: 방송 종료됨 ──
  BROADCAST_ENDED: {
    templateId: "TPL_BROADCAST_ENDED",
    description: "방송 종료 알림 → 관리자",
    buildMessage: (v) =>
      `[슈퍼무진] 방송 종료\n\n` +
      `방송명: ${v.broadcastTitle || "-"}\n` +
      `셀러: ${v.sellerName || "-"}\n` +
      `방송이 종료되었습니다.`,
  },

  // ── PROPOSAL-09: 샘플 결제 완료 ──
  SAMPLE_CHECKOUT: {
    templateId: "TPL_SAMPLE_CHECKOUT",
    description: "샘플 결제 완료 알림 → 관리자",
    buildMessage: (v) =>
      `[슈퍼무진] 샘플 요청 알림\n\n` +
      `요청자: ${v.requesterName || "-"}\n` +
      `상품 수: ${v.itemCount || "-"}건\n` +
      `샘플 요청이 접수되었습니다. 확인해 주세요.`,
  },
};
