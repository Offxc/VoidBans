"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DurationInput, formatDuration } from "@/components/DurationInput";

interface Template {
  id: string;
  name: string;
  type: "BAN" | "MUTE" | "KICK" | "WARN";
  defaultReason: string;
  defaultDuration: number | null;
  defaultAppealable: boolean;
}

export function TemplateEditor({ templates, canEdit }: { templates: Template[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Template["type"]>("BAN");
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [appealable, setAppealable] = useState(false);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    try {
      await fetch("/api/staff/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          defaultReason: reason,
          defaultDurationSeconds: durationSeconds ?? undefined,
          defaultAppealable: appealable,
        }),
      });
      setOpen(false);
      setName("");
      setReason("");
      setDurationSeconds(null);
      setAppealable(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {templates.map((t) => (
          <div key={t.id} className="vb-card">
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t.type}</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>{t.defaultReason}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
              {t.defaultDuration ? formatDuration(t.defaultDuration) : "Permanent"} ·{" "}
              {t.defaultAppealable ? "Appealable" : "Not appealable"}
            </div>
          </div>
        ))}
        {templates.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No templates yet.</p>}
      </div>

      {canEdit && !open && (
        <button onClick={() => setOpen(true)} className="vb-btn vb-btn-primary" style={{ marginTop: 16 }}>
          New template
        </button>
      )}

      {canEdit && open && (
        <div className="vb-panel" style={{ padding: 18, marginTop: 14, maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="vb-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="vb-select" value={type} onChange={(e) => setType(e.target.value as Template["type"])}>
            <option value="BAN">Ban</option>
            <option value="MUTE">Mute</option>
            <option value="KICK">Kick</option>
            <option value="WARN">Warn</option>
          </select>
          <textarea
            className="vb-textarea"
            placeholder="Default reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <DurationInput
            label="Default duration (blank = permanent)"
            seconds={durationSeconds}
            onChange={setDurationSeconds}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
            <input type="checkbox" checked={appealable} onChange={(e) => setAppealable(e.target.checked)} />
            Appealable by default
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={create} disabled={saving || !name || !reason} className="vb-btn vb-btn-primary">
              {saving ? "Saving…" : "Create"}
            </button>
            <button onClick={() => setOpen(false)} className="vb-btn vb-btn-quiet">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
