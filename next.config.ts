import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: serverExternalPackages does NOT work with Turbopack (Next.js 16).
  // Optional SDKs (solapi, popbill) use eval('require') pattern instead.
  // See: lib/services/notifications/solapi.client.ts, lib/services/tax-invoice/popbill.client.ts
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dl.airtable.com",
      },
      {
        protocol: "https",
        hostname: "v5.airtableusercontent.com",
      },
      {
        protocol: "https",
        hostname: "shopping-phinf.pstatic.net",
      },
      {
        protocol: "https",
        hostname: "*.pstatic.net",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: process.env.NODE_ENV === "development"
              ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://dl.airtable.com https://v5.airtableusercontent.com https://*.pstatic.net https://*.vercel-storage.com; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://dl.airtable.com https://v5.airtableusercontent.com https://*.pstatic.net https://*.vercel-storage.com; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
