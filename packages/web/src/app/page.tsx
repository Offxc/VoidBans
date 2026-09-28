import Link from "next/link";
import { BanLookupForm } from "@/components/BanLookup";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "flex-end", padding: "20px 24px" }}>
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
          <p style={{ color: "var(--text-dim)", margin: 0, fontSize: 14.5 }}>
            Enter the ban ID from your in-game message to view punishment details or submit an appeal.
          </p>
          <BanLookupForm />
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
