"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PunishmentModesEditor({
  templatesEnabled: initialTemplates,
  rulesEnabled: initialRules,
}: {
  templatesEnabled: boolean;
  rulesEnabled: boolean;
}) {
  const router = useRouter();
  const [templatesEnabled, setTemplatesEnabled] = useState(initialTemplates);
  const [rulesEnabled, setRulesEnabled] = useState(initialRules);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/staff/settings/punishment-modes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templatesEnabled, rulesEnabled }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={templatesEnabled} onChange={(e) => setTemplatesEnabled(e.target.checked)} />
        Templates
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={rulesEnabled} onChange={(e) => setRulesEnabled(e.target.checked)} />
        Rule-based (pick from the rulebook)
      </label>
      <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary" style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
