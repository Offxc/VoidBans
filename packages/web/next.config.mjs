import { readFileSync } from "node:fs";

// Single source of truth for the site version is package.json; it is baked
// in at build time so the footer and staff sidebar can show it.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  reactStrictMode: true,
  output: "standalone",
  // Security headers (including a nonce-based CSP) are set in
  // src/middleware.ts instead of here, a static header set at build time
  // can't include a per-request nonce, which Next.js's own inline
  // hydration scripts need to pass script-src without falling back to
  // 'unsafe-inline'. See middleware.ts for the full explanation.
};

export default nextConfig;
