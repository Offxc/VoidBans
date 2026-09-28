"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";

export function RulesEditor({ enabled: initialEnabled, markdown: initialMarkdown }: { enabled: boolean; markdown: string }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/staff/settings/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, markdown }),
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Show a &quot;Rules&quot; button on the homepage
        </label>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="vb-btn vb-btn-ghost"
          style={{ padding: "6px 12px", fontSize: 12.5 }}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>

      {showPreview ? (
        <div className="vb-panel" style={{ padding: 20, maxHeight: 480, overflowY: "auto" }}>
          <MarkdownContent markdown={markdown} />
        </div>
      ) : (
        <textarea
          className="vb-textarea"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={16}
          placeholder="## Chat Rules&#10;&#10;### C1: Harassment&#10;Do not harass other players or staff."
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary">
          {saving ? "Saving…" : "Save rules"}
        </button>
        {saved && <span style={{ color: "var(--success)", fontSize: 13 }}>Saved.</span>}
      </div>
    </div>
  );
}
