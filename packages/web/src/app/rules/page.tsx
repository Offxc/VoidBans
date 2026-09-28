import Link from "next/link";
import { notFound } from "next/navigation";
import { isRulesPageEnabled, getRulesByCategory } from "@/lib/rules";

// Reads site_settings + rule/category rows live — must not be statically
// prerendered at build time (no DATABASE_URL available then).
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const enabled = await isRulesPageEnabled();
  if (!enabled) notFound();

  const categories = await getRulesByCategory();

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-dim)" }}>
        ← Back
      </Link>

      <h1 style={{ fontSize: 26, margin: "20px 0 24px" }}>Server Rules</h1>

      {categories.map(
        (category) =>
          category.rules.length > 0 && (
            <div key={category.id.toString()} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>{category.name}</h2>
              {category.description && (
                <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 0 }}>{category.description}</p>
              )}
              <div className="vb-panel" style={{ padding: 8 }}>
                {category.rules.map((rule) => (
                  <div
                    key={rule.id.toString()}
                    style={{ padding: "14px 16px", borderTop: "1px solid rgba(168, 130, 255, 0.08)" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {rule.code} — {rule.title}
                    </div>
                    {rule.description && (
                      <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                        {rule.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ),
      )}

      {categories.every((c) => c.rules.length === 0) && (
        <p style={{ color: "var(--text-dim)" }}>No rules published yet.</p>
      )}
    </main>
  );
}
