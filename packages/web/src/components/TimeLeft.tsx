"use client";

import { useEffect, useState } from "react";

/** "3 days 4 hours left", counting down while the page stays open. Renders nothing once it has passed. */
export function TimeLeft({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setText(formatTimeLeft(new Date(iso).getTime() - Date.now()));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [iso]);

  if (!text) return null;
  return <span suppressHydrationWarning>{text}</span>;
}

export function formatTimeLeft(ms: number): string | null {
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  let parts: string[];
  if (days > 0) parts = hours > 0 ? [unit(days, "day"), unit(hours, "hour")] : [unit(days, "day")];
  else if (hours > 0) parts = mins > 0 ? [unit(hours, "hour"), unit(mins, "minute")] : [unit(hours, "hour")];
  else parts = [unit(mins, "minute")];
  return `${parts.join(" ")} left`;
}
