/**
 * 환경 변수 검증 및 타입 안전 접근
 */

interface Env {
  DATABASE_URL: string;
  DIRECT_URL?: string;
  AUTH_SECRET: string;
  AUTH_URL: string;
  NODE_ENV: string;
  DEV_AUTH_BYPASS?: string;
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const env: Env = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    DIRECT_URL: process.env.DIRECT_URL,
    AUTH_SECRET: process.env.AUTH_SECRET || "",
    AUTH_URL: process.env.AUTH_URL || "http://localhost:3000",
    NODE_ENV: process.env.NODE_ENV || "development",
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
  };

  // Production 환경에서 필수 환경 변수 검증
  if (process.env.NODE_ENV === "production") {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is required");
  }

  cachedEnv = env;
  return env;
}
