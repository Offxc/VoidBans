import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export const dynamic = "force-dynamic";

// Set CONTACT_EMAIL in .env; it is deliberately not hardcoded in the repo.
const contact = process.env.CONTACT_EMAIL;

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="vb-doc">
        <h1 className="vb-doc-title">Terms of Use</h1>
        <p className="vb-doc-meta">Last updated: 28 September 2026.</p>
        <div className="vb-prose">

        <h2>What this site is</h2>
        <p>
          This site is a ban lookup and moderation dashboard for the Minecraft server it&apos;s
          attached to. It isn&apos;t a game service itself. Playing on the server is governed by
          its own rules (see the server&apos;s <Link href="/rules">rules page</Link>, where
          enabled), and this site exists to make punishment records visible and appealable.
        </p>

        <h2>Punishments and IDs</h2>
        <p>
          Every punishment issued gets an ID, which anyone can look up on this site to see the
          reason, type, and status. Issuing, revoking, or editing a punishment is entirely at the
          discretion of the server&apos;s staff, based on the server&apos;s own rules. This site
          only records and displays that decision, it doesn&apos;t make it.
        </p>

        <h2>Appeals</h2>
        <p>
          A punishment marked appealable can be appealed once from its page. Submitting an
          appeal means giving a truthful, good-faith account. Appeals submitted in bad faith
          (false statements, spam, harassment of staff) may be denied without further review and
          can affect how a future appeal from the same account is handled. Staff decisions on
          appeals are final; there is no further appeal process beyond what&apos;s offered here.
        </p>

        <h2>Account and access</h2>
        <p>
          Staff access to the dashboard is granted through Discord sign-in and role-based
          permissions set by the server&apos;s owner. Staff are expected to use dashboard access
          only for legitimate moderation of the server, not to look up, punish, or otherwise act
          on players for unrelated reasons.
        </p>

        <h2>No warranty</h2>
        <p>
          This site is provided as-is, without warranty of any kind. We don&apos;t guarantee
          uninterrupted availability, and we&apos;re not liable for losses arising from downtime,
          data loss, or errors in punishment or appeal records, to the extent permitted by law.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated as the site changes. Continued use after an update means you
          accept the current version.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          {contact ? <a href={`mailto:${contact}`}>{contact}</a> : "the server staff"}.
        </p>
      </div>
      </div>
    </SiteShell>
  );
}
