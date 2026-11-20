import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@woorisai/shared"],
  poweredByHeader: false,
  logging: { incomingRequests: false },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_BASE_URL ?? "http://127.0.0.1:4000"}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};
export default config;
