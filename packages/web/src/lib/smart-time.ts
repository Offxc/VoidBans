/**
 * "just now", "6 hours ago", "2 days ago", then a plain date once it is old
 * enough that a count of days stops being useful. The year is left off for
 * dates in the current year.
 */
export function formatSmartTime(date: Date, now: number = Date.now(), locale?: string): string {
  const diffMs = now - date.getTime();
  const full = () =>
    date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  // A time in the future (clock drift, or an expiry) isn't "ago".
  if (diffMs < -60_000) return full();

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return plural(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, "day");

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(locale, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}
