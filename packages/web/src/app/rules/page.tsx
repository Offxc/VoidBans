import Link from "next/link";
import { notFound } from "next/navigation";
import { getRulesConfig } from "@/lib/rules";
import { MarkdownContent } from "@/components/MarkdownContent";

// Reads site_settings live (whether rules are enabled, and their current
// content) — must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { enabled, markdown } = await getRulesConfig();
  if (!enabled) notFound();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
        ← Back
      </Link>

      <div className="vb-panel" style={{ padding: "36px 40px", marginTop: 20 }}>
        <MarkdownContent markdown={markdown} />
      </div>
    </main>
  );
}
