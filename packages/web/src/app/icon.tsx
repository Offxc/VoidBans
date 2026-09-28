import { getSiteIconUrl } from "@/lib/site-icon";

// Next's file-convention favicon (auto-served at /icon, auto-linked from
// <head>). This convention wraps whatever this file exports in its own
// route handler — it does NOT want us to export GET ourselves (that
// causes a "Duplicate export 'GET'" build failure) — so the shape here is
// an async default export returning a Response with the image bytes.
//
// Proxies the actual bytes through our own server rather than redirecting
// to the postimages.org URL, since a redirect isn't guaranteed to be
// honoured the same way by every browser's favicon-fetching logic.
export const dynamic = "force-dynamic";
export const contentType = "image/png";

export default async function Icon() {
  const iconUrl = await getSiteIconUrl();

  if (!iconUrl) {
    // No icon configured — a 404 here just means "no custom favicon",
    // browsers fall back to their own default silently.
    return new Response(null, { status: 404 });
  }

  const upstream = await fetch(iconUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: 404 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
