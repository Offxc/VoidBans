/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: https://mc-heads.net https://crafatar.com https://cdn.discordapp.com",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      // BlueMap is embedded only on the staff BlueMap tab; scope this to that
      // route with a per-page frame-src override once the BlueMap host is known,
      // rather than loosening the global default here.
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

function blueMapOrigin() {
  if (!process.env.BLUEMAP_URL) return null;
  try {
    return new URL(process.env.BLUEMAP_URL).origin;
  } catch {
    return null;
  }
}

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    const rules = [{ source: "/:path*", headers: securityHeaders }];

    const origin = blueMapOrigin();
    if (origin) {
      // Only this one route gets a wider frame-src, and only to the
      // configured BlueMap origin — every other page keeps frame-src 'none'.
      const bluemapCsp = securityHeaders.map((h) =>
        h.key === "Content-Security-Policy"
          ? { key: h.key, value: h.value.replace("frame-src 'none'", `frame-src 'self' ${origin}`) }
          : h,
      );
      rules.push({ source: "/staff/bluemap", headers: bluemapCsp });
    }

    return rules;
  },
};

export default nextConfig;
