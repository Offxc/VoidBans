const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Login expired or was tampered with. Try again.",
  oauth_failed: "Discord sign-in failed. Try again.",
};

export default function StaffLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="vb-panel-strong"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "40px 36px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Staff Login</h1>
        {error && <p style={{ color: "var(--danger)", fontSize: 13.5 }}>{error}</p>}

        {isDev ? (
          <>
            <a href="/api/dev-login" className="vb-btn vb-btn-primary" style={{ textDecoration: "none" }}>
              Dev login (seeded owner)
            </a>
            <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 300, margin: 0 }}>
              Discord OAuth is configured with placeholder credentials in this environment, so
              &quot;Continue with Discord&quot; below won&apos;t actually work.
            </p>
            <a href="/api/auth/login" style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Continue with Discord anyway
            </a>
          </>
        ) : (
          <a
            href="/api/auth/login"
            className="vb-btn"
            style={{ background: "#5865F2", color: "#fff", textDecoration: "none" }}
          >
            Continue with Discord
          </a>
        )}
      </div>
    </main>
  );
}
