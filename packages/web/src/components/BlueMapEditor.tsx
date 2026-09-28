"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BlueMapEditor({ enabled, url }: { enabled: boolean; url: string | null }) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [urlValue, setUrlValue] = useState(url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/settings/bluemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: isEnabled, url: urlValue.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to save.");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
        Show BlueMap tab to staff with the bluemap.view permission
      </label>
      <input
        className="vb-input"
        value={urlValue}
        onChange={(e) => setUrlValue(e.target.value)}
        placeholder="https://map.example.com/…"
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary" style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
