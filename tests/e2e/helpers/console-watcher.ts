/**
 * Console/Network Error Watcher for E2E Tests
 *
 * 페이지 진입 시 발생하는 콘솔 에러, 페이지 에러, 5xx 응답을 캡처하여
 * "보이지 않는 버그" (예: TypeError, OOM, 500 응답) 를 자동 감지한다.
 */

import { Page } from '@playwright/test';

export interface ErrorCapture {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: { url: string; status: number }[];
}

/**
 * 페이지에 에러 감시 리스너를 부착한다.
 * page.goto() 호출 전에 실행해야 최초 로드 에러도 잡을 수 있다.
 */
export function attachErrorWatcher(page: Page): ErrorCapture {
  const capture: ErrorCapture = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // 무시 대상:
      if (
        // 외부 광고/분석 스크립트
        text.includes('googletagmanager') ||
        text.includes('hotjar') ||
        text.includes('analytics') ||
        text.includes('gtag') ||
        text.includes('facebook') ||
        text.includes('fbq') ||
        // Next.js 개발 모드 워닝
        text.includes('Fast Refresh') ||
        // 브라우저 확장 프로그램 에러
        text.includes('chrome-extension://') ||
        // 리소스 404 (favicon, chunk 등) — 5xx는 failedRequests에서 별도 캡처
        text.includes('Failed to load resource') ||
        text.includes('favicon.ico') ||
        // Next.js hydration 관련 무해 워닝
        text.includes('Hydration') ||
        // 네트워크 에러 (일시적 연결 실패)
        text.includes('net::ERR_')
      ) {
        return;
      }
      capture.consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    capture.pageErrors.push(err.message);
  });

  page.on('response', (res) => {
    const url = res.url();
    // 외부 서비스 5xx는 무시
    if (
      url.includes('googletagmanager') ||
      url.includes('hotjar') ||
      url.includes('analytics') ||
      url.includes('sentry')
    ) {
      return;
    }
    if (res.status() >= 500) {
      capture.failedRequests.push({ url, status: res.status() });
    }
  });

  return capture;
}

/**
 * 캡처된 에러가 있으면 상세 메시지와 함께 throw한다.
 */
export function assertNoErrors(capture: ErrorCapture, context: string) {
  const issues: string[] = [];
  if (capture.consoleErrors.length > 0) {
    issues.push(`Console errors (${capture.consoleErrors.length}):\n  ${capture.consoleErrors.join('\n  ')}`);
  }
  if (capture.pageErrors.length > 0) {
    issues.push(`Page errors (${capture.pageErrors.length}):\n  ${capture.pageErrors.join('\n  ')}`);
  }
  if (capture.failedRequests.length > 0) {
    issues.push(
      `5xx responses (${capture.failedRequests.length}):\n  ${capture.failedRequests
        .map((r) => `${r.status} ${r.url}`)
        .join('\n  ')}`
    );
  }
  if (issues.length > 0) {
    throw new Error(`[${context}] 페이지에서 에러 감지:\n\n${issues.join('\n\n')}`);
  }
}
