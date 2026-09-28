import Link from "next/link";
import { BanLookupForm } from "@/components/BanLookup";
import { getRulesConfig } from "@/lib/rules";
import { getSiteIconUrl } from "@/lib/site-icon";

// Reads site_settings at request time (whether the Rules button should
// show) — force dynamic so this never gets baked into a static page at
// build time with no DATABASE_URL available, the same class of bug fixed
// earlier for /api/dev-login and /api/appeal-questions.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ enabled: rulesEnabled }, iconUrl] = await Promise.all([getRulesConfig(), getSiteIconUrl()]);

  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px" }}>
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" width={32} height={32} style={{ borderRadius: 8 }} />
        ) : (
          <span />
        )}
        <Link href="/staff/login" className="vb-btn vb-btn-ghost" style={{ textDecoration: "none" }}>
          Staff Login
        </Link>
      </header>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          className="vb-panel-strong"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            padding: "44px 40px",
            maxWidth: 480,
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: 30, margin: 0, textWrap: "balance" }}>VoidSMP Bans</h1>
          <BanLookupForm />
          {rulesEnabled && (
            <Link href="/rules" className="vb-btn vb-btn-ghost" style={{ textDecoration: "none" }}>
              Server Rules
            </Link>
          )}
        </div>
      </section>

      <footer
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          padding: "20px 24px",
          fontSize: 13,
          color: "var(--text-dim)",
        }}
      >
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Use</Link>
      </footer>
    </main>
  );
}
