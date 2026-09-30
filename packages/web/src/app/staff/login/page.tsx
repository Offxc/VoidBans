import Link from "next/link";
import { getSiteIconUrl } from "@/lib/site-icon";
import { Brand } from "@/components/Brand";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Login expired or was tampered with. Try again.",
  oauth_failed: "Discord sign-in failed. Try again.",
};

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.2.5c1.8.4 2.7 1 3.6 1.7a15.2 15.2 0 0 0-13.6 0c1-.8 2-1.4 3.7-1.7L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.8 19.8 0 0 0 6 3l1.3-1.8a12.8 12.8 0 0 1-2-1l.5-.4a14.1 14.1 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 1.8a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.5-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

export default async function StaffLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;
  const isDev = process.env.NODE_ENV === "development";
  const iconUrl = await getSiteIconUrl();

  return (
    <main className="vb-auth">
      <div className="vb-auth-card">
        <Brand iconUrl={iconUrl} />
        <div>
          <h1>Staff sign in</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5, margin: "6px 0 0" }}>
            Access comes from your role in the Discord server.
          </p>
        </div>

        {error && (
          <p className="vb-pill vb-pill-danger" style={{ margin: 0, whiteSpace: "normal", padding: "6px 12px" }}>
            {error}
          </p>
        )}

        {isDev && (
          <a href="/api/dev-login" className="vb-btn vb-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Dev login (seeded owner)
          </a>
        )}
        <a href="/api/auth/login" className="vb-btn vb-discord-btn">
          <DiscordIcon />
          Continue with Discord
        </a>

        <Link href="/" style={{ fontSize: 13, color: "var(--text-faint)", textDecoration: "none" }}>
          Back to ban lookup
        </Link>
      </div>
    </main>
  );
}
