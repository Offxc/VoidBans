"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IntegrationsEditor({ vulcanEnabled }: { vulcanEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(vulcanEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await fetch("/api/staff/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulcanEnabled: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="vb-panel"
      style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Vulcan Anticheat</div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 0", maxWidth: 440 }}>
          Violation history and detected client on player profiles. Needs Vulcan installed on the server.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`vb-btn ${enabled ? "vb-btn-primary" : "vb-btn-ghost"}`}
        style={{ flexShrink: 0 }}
      >
        {enabled ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}
