"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEBHOOK_EVENT_KEYS, WEBHOOK_EVENT_LABELS, type WebhookEventKey } from "@/lib/discord-webhook";

export function DiscordWebhookEditor({
  url: initialUrl,
  events: initialEvents,
}: {
  url: string | null;
  events: Record<WebhookEventKey, boolean>;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [events, setEvents] = useState(initialEvents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleEvent(key: WebhookEventKey) {
    setEvents((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/staff/settings/discord-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() || null, events }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="vb-field" style={{ marginBottom: 0 }}>
        Webhook URL
        <input
          className="vb-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
        />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {WEBHOOK_EVENT_KEYS.map((key) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
            <input type="checkbox" checked={events[key]} onChange={() => toggleEvent(key)} />
            {WEBHOOK_EVENT_LABELS[key]}
          </label>
        ))}
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} disabled={saving} className="vb-btn vb-btn-primary" style={{ alignSelf: "flex-start" }}>
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span style={{ color: "var(--success)", fontSize: 13 }}>Saved.</span>}
      </div>
    </div>
  );
}
