import { SiteShell } from "@/components/SiteShell";

export const dynamic = "force-dynamic";

// Set CONTACT_EMAIL in .env; it is deliberately not hardcoded in the repo.
const contact = process.env.CONTACT_EMAIL;

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="vb-doc">
        <h1 className="vb-doc-title">Privacy Policy</h1>
        <p className="vb-doc-meta">Last updated: 28 September 2026.</p>
        <div className="vb-prose">

        <h2>What we collect</h2>
        <ul>
          <li>Minecraft UUID, username, and session times (login/logout, playtime) for anyone who has played on the server.</li>
          <li>The IP address used for each login session. This is recorded for every player, not just those who are punished.</li>
          <li>Punishment records (reason, type, duration, appeal text) for anyone who has been punished. A punishment may also record the IP address in use at the time, when staff apply an IP ban.</li>
          <li>If the server owner has enabled the optional Vulcan Anticheat integration: anticheat violation history and detected game client for players it flags or reports on.</li>
          <li>For staff only: Discord ID, username, and avatar, collected when you sign in with Discord.</li>
        </ul>

        <h2>Why</h2>
        <p>
          To operate the punishment system, let players look up and appeal their own bans, let staff
          moderate the server, and to prevent banned players from rejoining on a different account from
          the same network.
        </p>
        <p>
          IP addresses and anticheat violation history are visible only to staff with specific,
          separately-granted permissions, not to every staff member with dashboard access.
        </p>

        <h2>Cookies</h2>
        <p>
          We use a single session cookie for staff sign-in. We don&apos;t use third-party trackers or
          analytics cookies.
        </p>

        <h2>Retention</h2>
        <p>
          While you&apos;re an active player, we hold your session, punishment, and (if applicable)
          appeal and anticheat data for as long as you continue playing. We also keep this as
          historical record after you stop playing. This is what lets staff look up your prior
          activity or punishment history if you return later, and lets a punishment or appeal stay
          resolvable and reviewable indefinitely rather than silently disappearing.
        </p>
        <p>
          If you&apos;d like your historical data reviewed, corrected, or deleted, contact us using
          the method below and we&apos;ll handle it directly. There&apos;s no automated
          self-service deletion tool at this time.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about your data, or to request a correction or deletion,{" "}
          {contact ? (
            <>
              email <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            "contact the server staff."
          )}
        </p>
      </div>
      </div>
    </SiteShell>
  );
}
