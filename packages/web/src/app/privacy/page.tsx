import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
        ← Back
      </Link>

      <div className="vb-panel" style={{ padding: 32, marginTop: 20, lineHeight: 1.7 }}>
        <h1 style={{ marginTop: 0 }}>Privacy Policy</h1>
        <p style={{ color: "var(--text-dim)" }}>Last updated: TODO before launch.</p>

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
        <p>TODO: state a concrete retention period for session and IP data.</p>

        <h2>Contact</h2>
        <p>TODO: add a contact method for data questions or appeals.</p>
      </div>
    </main>
  );
}
