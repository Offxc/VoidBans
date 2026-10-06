"use client";

import { useEffect, useState } from "react";
import { formatSmartTime } from "@/lib/smart-time";

/**
 * Renders a UTC ISO timestamp in the viewer's own local timezone. Server-
 * rendered with nothing (avoiding a hydration mismatch from SSR guessing
 * the wrong zone), then filled in client-side once mounted.
 */
export function LocalTime({ iso, relative = false, smart = false }: { iso: string; relative?: boolean; smart?: boolean }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (smart) {
      // "6 hours ago" goes stale while the page stays open, so keep it fresh.
      const update = () => setText(formatSmartTime(date));
      update();
      const timer = setInterval(update, 30_000);
      return () => clearInterval(timer);
    }
    if (relative) {
      setText(formatRelative(date));
    } else {
      setText(
        date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      );
    }
  }, [iso, relative, smart]);

  // The exact date and time is always one hover away, whichever form is shown.
  const exact = smart || relative ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : undefined;

  return (
    <span suppressHydrationWarning title={exact}>
      {text ?? "…"}
    </span>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
