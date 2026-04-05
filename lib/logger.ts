/**
 * 간단한 로거 — 서버 사이드 전용
 */

type LogLevel = "info" | "warn" | "error";

interface LogData {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, data?: LogData) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data,
  };

  if (level === "error") {
    console.error(JSON.stringify(logEntry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

export const logger = {
  info: (message: string, data?: LogData) => log("info", message, data),
  warn: (message: string, data?: LogData) => log("warn", message, data),
  error: (message: string, data?: LogData) => log("error", message, data),
};

export const securityLogger = {
  authFailed: (data: LogData) => log("warn", "Authentication failed", data),
  authzFailed: (data: LogData) => log("warn", "Authorization failed", data),
};

export function sanitizeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  return String(error);
}
