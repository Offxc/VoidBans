import Link from "next/link";

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
        ← Back
      </Link>

      <div className="vb-panel" style={{ padding: 32, marginTop: 20, lineHeight: 1.7 }}>
        <h1 style={{ marginTop: 0 }}>Terms of Use</h1>
        <p style={{ color: "var(--text-dim)" }}>Last updated: TODO before launch.</p>
        <p>TODO: server rules reference, appeal conduct expectations, disclaimer of liability.</p>
      </div>
    </main>
  );
}
