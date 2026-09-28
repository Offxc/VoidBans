"use client";

import { useEffect, useState } from "react";

/**
 * Renders a UTC ISO timestamp in the viewer's own local timezone. Server-
 * rendered with nothing (avoiding a hydration mismatch from SSR guessing
 * the wrong zone), then filled in client-side once mounted.
 */
export function LocalTime({ iso, relative = false }: { iso: string; relative?: boolean }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
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
  }, [iso, relative]);

  return <span suppressHydrationWarning>{text ?? "…"}</span>;
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
