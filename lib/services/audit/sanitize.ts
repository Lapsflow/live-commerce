const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "creditCard",
  "ssn",
  "pin",
])

export function sanitize(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!data) return null

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "***REDACTED***"
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = sanitize(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}
