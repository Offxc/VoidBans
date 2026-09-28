import Link from "next/link";

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
        ← Back
      </Link>

      <div className="vb-panel" style={{ padding: 32, marginTop: 20, lineHeight: 1.7 }}>
        <h1 style={{ marginTop: 0 }}>Terms of Use</h1>
        <p style={{ color: "var(--text-dim)" }}>Last updated: 28 September 2026.</p>

        <h2>What this site is</h2>
        <p>
          This site is a ban lookup and moderation dashboard for the Minecraft server it&apos;s
          attached to. It isn&apos;t a game service itself — playing on the server is governed by
          its own rules (see the server&apos;s <Link href="/rules">rules page</Link>, where
          enabled), and this site exists to make punishment records visible and appealable.
        </p>

        <h2>Punishments and ban IDs</h2>
        <p>
          Every punishment issued gets a ban ID, which anyone can look up on this site to see the
          reason, type, and status. Issuing, revoking, or editing a punishment is entirely at the
          discretion of the server&apos;s staff, based on the server&apos;s own rules — this site
          only records and displays that decision, it doesn&apos;t make it.
        </p>

        <h2>Appeals</h2>
        <p>
          A punishment marked appealable can be appealed once from its ban ID page. Submitting an
          appeal means giving a truthful, good-faith account — appeals submitted in bad faith
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
          <a href="mailto:contact@your-domain.example">contact@your-domain.example</a>.
        </p>
      </div>
    </main>
  );
}
