import Link from "next/link";
import { getSiteIconUrl } from "@/lib/site-icon";
import { isRulesPageEnabled } from "@/lib/rules";
import { Brand } from "@/components/Brand";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [iconUrl, rulesEnabled] = await Promise.all([getSiteIconUrl(), isRulesPageEnabled()]);

  return (
    <div className="vb-site">
      <header className="vb-site-nav">
        <Brand iconUrl={iconUrl} />
        <nav className="vb-site-links">
          {rulesEnabled && (
            <Link href="/rules" className="vb-btn vb-btn-quiet">
              Rules
            </Link>
          )}
          <Link href="/staff/login" className="vb-btn vb-btn-ghost">
            Staff login
          </Link>
        </nav>
      </header>

      <main className="vb-site-main">{children}</main>

      <footer className="vb-site-footer">
        <div className="vb-site-footer-inner">
          <span>© VoidSMP</span>
          <div style={{ display: "flex", gap: 20 }}>
            {rulesEnabled && <Link href="/rules">Rules</Link>}
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
