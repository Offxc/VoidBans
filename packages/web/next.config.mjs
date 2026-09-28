/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Security headers (including a nonce-based CSP) are set in
  // src/middleware.ts instead of here — a static header set at build time
  // can't include a per-request nonce, which Next.js's own inline
  // hydration scripts need to pass script-src without falling back to
  // 'unsafe-inline'. See middleware.ts for the full explanation.
};

export default nextConfig;
