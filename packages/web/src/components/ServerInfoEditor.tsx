"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ServerInfoEditor({ name, address, discordInvite }: { name: string; address: string; discordInvite: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name, address, discordInvite });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/settings/server-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Failed to save.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="vb-field">
        Server name
        <input className="vb-input" value={values.name} maxLength={48} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className="vb-field">
        Server address
        <input
          className="vb-input"
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="play.example.com"
          spellCheck={false}
        />
      </label>
      <label className="vb-field">
        Discord invite
        <input
          className="vb-input"
          value={values.discordInvite}
          onChange={(e) => set("discordInvite", e.target.value)}
          placeholder="https://discord.gg/…"
          spellCheck={false}
        />
      </label>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span style={{ color: "var(--success)", fontSize: 13 }}>Saved</span>}
      </div>
    </div>
  );
}
