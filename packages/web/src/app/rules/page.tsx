import { notFound } from "next/navigation";
import { isRulesPageEnabled, getRulesByCategory } from "@/lib/rules";
import { SiteShell } from "@/components/SiteShell";

// Reads site_settings + rule/category rows live — must not be statically
// prerendered at build time (no DATABASE_URL available then).
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const enabled = await isRulesPageEnabled();
  if (!enabled) notFound();

  const categories = (await getRulesByCategory()).filter((c) => c.rules.length > 0);

  return (
    <SiteShell>
      <div className="vb-doc">
        <h1 className="vb-doc-title">Server rules</h1>
        <p className="vb-doc-meta">Breaking these can result in a warning, mute, kick, or ban.</p>

        {categories.length > 1 && (
          <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {categories.map((c) => (
              <a key={c.id.toString()} href={`#cat-${c.id}`} className="vb-btn vb-btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }}>
                {c.name}
              </a>
            ))}
          </nav>
        )}

        {categories.map((category) => (
          <section key={category.id.toString()} id={`cat-${category.id}`} className="vb-section" style={{ scrollMarginTop: 24 }}>
            <h2 style={{ fontSize: 19, margin: "0 0 4px" }}>{category.name}</h2>
            {category.description && (
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "0 0 14px" }}>{category.description}</p>
            )}
            <div className="vb-panel">
              {category.rules.map((rule, i) => (
                <div
                  key={rule.id.toString()}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr",
                    gap: 12,
                    padding: "14px 18px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--accent-text)", fontWeight: 600, fontFamily: "ui-monospace, monospace", fontSize: 13.5, paddingTop: 1 }}>
                    {rule.code}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{rule.title}</div>
                    {rule.description && (
                      <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 3, whiteSpace: "pre-wrap" }}>
                        {rule.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {categories.length === 0 && <p style={{ color: "var(--text-dim)" }}>No rules published yet.</p>}
      </div>
    </SiteShell>
  );
}
