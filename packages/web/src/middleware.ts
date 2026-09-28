import { NextRequest, NextResponse } from "next/server";

// Nonce-based CSP, generated fresh per request. A static `script-src 'self'`
// (the previous approach, in next.config.mjs) blocks every inline <script>
// Next.js itself emits for React hydration data — App Router pages always
// have at least one, and pages with more client components (like the
// appeals queue, one AppealResolveCard per pending appeal) emit several.
// That was silently breaking hydration and could crash a whole page. A
// nonce lets Next's own hydration scripts through (it tags them with this
// nonce automatically once it sees x-nonce on the request) without opening
// script-src up to 'unsafe-inline' generally.
function buildCsp(nonce: string, blueMapOrigin: string | null): string {
  return [
    "default-src 'self'",
    "img-src 'self' data: https://mc-heads.net https://crafatar.com https://cdn.discordapp.com",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    blueMapOrigin ? `frame-src 'self' ${blueMapOrigin}` : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function blueMapOrigin(): string | null {
  if (!process.env.BLUEMAP_URL) return null;
  try {
    return new URL(process.env.BLUEMAP_URL).origin;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, req.nextUrl.pathname === "/staff/bluemap" ? blueMapOrigin() : null);

  // Next reads x-nonce off the *request* headers to tag its own inline
  // scripts — has to be forwarded this way, not just set on the response.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    // Skip Next's static assets and image optimizer — no need to
    // recompute a nonce per request for files that don't hydrate.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
