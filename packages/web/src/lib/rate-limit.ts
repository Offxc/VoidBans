/**
 * Minimal in-memory fixed-window rate limiter. Fine for a single Node
 * process behind Caddy on one box; if this ever runs as multiple
 * instances, swap the store for Redis without changing the call sites.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function clientIpFromHeaders(headers: Headers): string {
  // When Cloudflare proxies traffic (orange cloud), it sets CF-Connecting-IP
  // to the real client IP, trust that first since it's harder to spoof
  // than X-Forwarded-For once Cloudflare is in front. Falls back to
  // X-Forwarded-For's first hop for a direct-to-Caddy deployment with no
  // CDN in front at all.
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
