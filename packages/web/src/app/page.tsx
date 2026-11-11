import Link from "next/link";
import { BanLookupForm } from "@/components/BanLookup";
import { CopyButton } from "@/components/CopyButton";
import { SiteShell } from "@/components/SiteShell";
import { getLockdown } from "@/lib/lockdown";
import { isRulesPageEnabled } from "@/lib/rules";
import { getServerInfo } from "@/lib/server-info";

// Reads site_settings at request time (icon, whether Rules shows) and must
// not be baked into a static page at build time with no DATABASE_URL.
export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Find your ID", text: "It's in your ban, kick, mute or warning message." },
  { title: "Look it up", text: "See the reason and when it ends." },
  { title: "Appeal", text: "If it can be appealed, the form is on the same page." },
];

export default async function HomePage() {
  const [server, rulesEnabled, lockdown] = await Promise.all([getServerInfo(), isRulesPageEnabled(), getLockdown()]);
  const hasCards = rulesEnabled || server.address !== "" || server.discordInvite !== "";

  return (
    <SiteShell>
      <section className="vb-hero">
        {lockdown.enabled && (
          <p className="vb-notice" role="status">
            The server is in maintenance mode right now.
          </p>
        )}
        <h1 className="vb-hero-title">Punishment lookup</h1>
        <BanLookupForm />
      </section>

      <ol className="vb-steps">
        {STEPS.map((step, i) => (
          <li key={step.title} className="vb-step">
            <span className="vb-step-num">{i + 1}</span>
            <div>
              <div className="vb-step-title">{step.title}</div>
              <p className="vb-step-text">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {hasCards && (
        <div className="vb-home-cards">
          {server.address !== "" && (
            <div className="vb-panel vb-home-card">
              <div className="vb-home-card-label">{server.name || "Server address"}</div>
              <div className="vb-home-card-row">
                <code className="vb-home-address">{server.address}</code>
                <CopyButton text={server.address} />
              </div>
            </div>
          )}
          {rulesEnabled && (
            <Link href="/rules" className="vb-panel vb-home-card vb-home-card-link">
              <div className="vb-home-card-label">Rules</div>
              <div className="vb-home-card-row">
                <span>Read the server rules</span>
                <span aria-hidden="true">→</span>
              </div>
            </Link>
          )}
          {server.discordInvite !== "" && (
            <a href={server.discordInvite} target="_blank" rel="noopener noreferrer" className="vb-panel vb-home-card vb-home-card-link">
              <div className="vb-home-card-label">Discord</div>
              <div className="vb-home-card-row">
                <span>Join the Discord</span>
                <span aria-hidden="true">→</span>
              </div>
            </a>
          )}
        </div>
      )}
    </SiteShell>
  );
}
