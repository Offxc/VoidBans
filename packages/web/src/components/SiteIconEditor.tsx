"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SiteIconEditor({ iconUrl }: { iconUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(iconUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/settings/icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() || null }),
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
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: 8, border: "1px solid var(--glass-border)", flexShrink: 0 }}
          />
        )}
        <input
          className="vb-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://i.postimg.cc/…"
        />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary" style={{ alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Save icon"}
      </button>
    </div>
  );
}
