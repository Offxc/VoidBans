/**
 * Absolute URL on the public site, built from SITE_URL and never from
 * req.url, behind a reverse proxy, req.url reflects whatever address
 * Next's own server is bound to (e.g. 0.0.0.0, or a Docker-internal
 * hostname), not the public domain the request actually arrived through,
 * since nothing forwards the original Host into how Next constructs
 * absolute URLs by default.
 */
export function siteUrl(path: string): URL {
  const base = process.env.SITE_URL;
  if (!base) throw new Error("SITE_URL is not set");
  return new URL(path, base);
}
