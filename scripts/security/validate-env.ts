/**
 * 환경변수 검증 스크립트
 *
 * Production 배포 전 필수 환경변수 검증
 * 사용법: npx tsx scripts/security/validate-env.ts
 */

interface EnvValidationRule {
  key: string;
  required: boolean;
  env: "development" | "production" | "all";
  description: string;
  pattern?: RegExp;
}

const ENV_RULES: EnvValidationRule[] = [
  // Database
  {
    key: "DATABASE_URL",
    required: true,
    env: "all",
    description: "PostgreSQL connection string (Neon)",
    pattern: /^postgres(ql)?:\/\/.+/,
  },
  {
    key: "DIRECT_URL",
    required: false,
    env: "production",
    description: "Direct database connection (non-pooled)",
  },

  // Authentication
  {
    key: "AUTH_SECRET",
    required: true,
    env: "production",
    description: "NextAuth secret (32+ characters)",
    pattern: /.{32,}/,
  },
  {
    key: "AUTH_URL",
    required: true,
    env: "production",
    description: "NextAuth base URL",
    pattern: /^https:\/\/.+/,
  },

  // Redis (Upstash)
  {
    key: "UPSTASH_REDIS_REST_URL",
    required: true,
    env: "production",
    description: "Upstash Redis REST URL",
    pattern: /^https:\/\/.+\.upstash\.io/,
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    required: true,
    env: "production",
    description: "Upstash Redis REST Token",
  },

  // External APIs - Marketplace
  {
    key: "NAVER_CLIENT_ID",
    required: true,
    env: "production",
    description: "Naver Shopping API Client ID",
  },
  {
    key: "NAVER_CLIENT_SECRET",
    required: true,
    env: "production",
    description: "Naver Shopping API Client Secret",
  },
  {
    key: "COUPANG_ACCESS_KEY",
    required: true,
    env: "production",
    description: "Coupang Partners API Access Key",
  },
  {
    key: "COUPANG_SECRET_KEY",
    required: true,
    env: "production",
    description: "Coupang Partners API Secret Key",
  },

  // AI Services
  {
    key: "ANTHROPIC_API_KEY",
    required: true,
    env: "production",
    description: "Claude API Key (AI analysis)",
    pattern: /^sk-ant-api03-.+/,
  },
  {
    key: "CLAUDE_MODEL",
    required: false,
    env: "all",
    description: "Claude model version",
  },

  // ONEWMS Integration
  {
    key: "ONEWMS_API_URL",
    required: true,
    env: "production",
    description: "ONEWMS API base URL",
    pattern: /^https?:\/\/.+/,
  },
  {
    key: "ONEWMS_API_KEY",
    required: true,
    env: "production",
    description: "ONEWMS API Key",
  },

  // Google Sheets (Warehouse Sync)
  {
    key: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    required: true,
    env: "production",
    description: "Google Service Account Email",
    pattern: /^.+@.+\.iam\.gserviceaccount\.com$/,
  },
  {
    key: "GOOGLE_PRIVATE_KEY",
    required: true,
    env: "production",
    description: "Google Service Account Private Key (base64)",
  },
  {
    key: "WAREHOUSE_SHEET_ID",
    required: true,
    env: "production",
    description: "Google Sheets ID for warehouse sync",
  },

  // Payment (Toss Payments)
  {
    key: "TOSS_CLIENT_KEY",
    required: false,
    env: "production",
    description: "Toss Payments Client Key (Public)",
  },
  {
    key: "TOSS_SECRET_KEY",
    required: false,
    env: "production",
    description: "Toss Payments Secret Key",
  },

  // Email Notifications
  {
    key: "SENDGRID_API_KEY",
    required: true,
    env: "production",
    description: "SendGrid API Key for email notifications",
    pattern: /^SG\..+/,
  },
  {
    key: "SENDGRID_FROM_EMAIL",
    required: true,
    env: "production",
    description: "Verified sender email address",
    pattern: /^.+@.+\..+$/,
  },

  // Cron Secret
  {
    key: "CRON_SECRET",
    required: true,
    env: "production",
    description: "Secret for authenticating cron jobs",
    pattern: /.{32,}/,
  },

  // Development Only
  {
    key: "DEV_AUTH_BYPASS",
    required: false,
    env: "development",
    description: "⚠️ Development auth bypass (DO NOT USE IN PRODUCTION)",
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
  invalid: string[];
}

function validateEnvironment(): ValidationResult {
  const currentEnv = process.env.NODE_ENV || "development";
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    invalid: [],
  };

  console.log(`\n🔍 Validating environment variables for: ${currentEnv}\n`);

  for (const rule of ENV_RULES) {
    // Skip if rule doesn't apply to current environment
    if (rule.env !== "all" && rule.env !== currentEnv) {
      continue;
    }

    const value = process.env[rule.key];

    // Check if required variable is missing
    if (rule.required && !value) {
      result.valid = false;
      result.missing.push(rule.key);
      result.errors.push(`❌ ${rule.key}: Missing (Required for ${rule.env})`);
      continue;
    }

    // Skip optional missing variables
    if (!value) {
      result.warnings.push(`⚠️  ${rule.key}: Not set (Optional)`);
      continue;
    }

    // Validate pattern if provided
    if (rule.pattern && !rule.pattern.test(value)) {
      result.valid = false;
      result.invalid.push(rule.key);
      result.errors.push(
        `❌ ${rule.key}: Invalid format (Expected: ${rule.pattern.source})`
      );
      continue;
    }

    // Success
    console.log(`✅ ${rule.key}: OK`);
  }

  return result;
}

function checkClientSideExposure(): void {
  console.log(`\n🔒 Checking for client-side exposure risks...\n`);

  const dangerousVars = Object.keys(process.env).filter(
    (key) =>
      !key.startsWith("NEXT_PUBLIC_") &&
      (key.includes("SECRET") ||
        key.includes("KEY") ||
        key.includes("TOKEN") ||
        key.includes("PASSWORD"))
  );

  if (dangerousVars.length > 0) {
    console.log(`✅ ${dangerousVars.length} sensitive variables are server-only:`);
    dangerousVars.forEach((key) => {
      console.log(`   - ${key}`);
    });
  }

  const publicVars = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_")
  );

  if (publicVars.length > 0) {
    console.log(`\n⚠️  ${publicVars.length} variables exposed to client:`);
    publicVars.forEach((key) => {
      console.log(`   - ${key}`);
    });
    console.log(
      `\n⚠️  Make sure these contain NO sensitive information!\n`
    );
  }
}

function printSummary(result: ValidationResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("📋 Validation Summary");
  console.log("=".repeat(60) + "\n");

  if (result.valid) {
    console.log("✅ All required environment variables are valid!\n");
  } else {
    console.log("❌ Environment validation FAILED!\n");

    if (result.missing.length > 0) {
      console.log(`Missing variables (${result.missing.length}):`);
      result.missing.forEach((key) => console.log(`   - ${key}`));
      console.log();
    }

    if (result.invalid.length > 0) {
      console.log(`Invalid variables (${result.invalid.length}):`);
      result.invalid.forEach((key) => console.log(`   - ${key}`));
      console.log();
    }
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    result.warnings.slice(0, 5).forEach((warning) => console.log(`   ${warning}`));
    if (result.warnings.length > 5) {
      console.log(`   ... and ${result.warnings.length - 5} more`);
    }
    console.log();
  }

  console.log("=".repeat(60) + "\n");
}

// Main execution
function main() {
  const result = validateEnvironment();
  checkClientSideExposure();
  printSummary(result);

  if (!result.valid) {
    console.error("❌ Environment validation failed. Fix errors before deploying to production.\n");
    process.exit(1);
  }

  console.log("✅ Environment validation passed!\n");
  process.exit(0);
}

main();
