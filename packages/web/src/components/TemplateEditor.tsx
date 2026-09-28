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

// Mirrors PunishmentPanel's ACTIONS — templates are stored by raw
// PunishmentType + an optional duration, but staff pick "Temp Ban" vs
// "Ban" explicitly here rather than a bare type dropdown plus an implied
// "blank duration means permanent" convention, which wasn't discoverable
// and made temp-ban/temp-mute templates look like they didn't exist.
const ACTION_KINDS = [
  { key: "mute", label: "Mute", type: "MUTE" as const, hasDuration: false },
  { key: "temp_mute", label: "Temp mute", type: "MUTE" as const, hasDuration: true },
  { key: "kick", label: "Kick", type: "KICK" as const, hasDuration: false },
  { key: "warn", label: "Warn", type: "WARN" as const, hasDuration: false },
  { key: "temp_ban", label: "Temp ban", type: "BAN" as const, hasDuration: true },
  { key: "ban", label: "Ban", type: "BAN" as const, hasDuration: false },
];

export function TemplateEditor({ templates, canEdit }: { templates: Template[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [actionKey, setActionKey] = useState(ACTION_KINDS[0]!.key);
  const [reason, setReason] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [appealable, setAppealable] = useState(false);
  const [saving, setSaving] = useState(false);

  const action = ACTION_KINDS.find((a) => a.key === actionKey)!;

  async function create() {
    setSaving(true);
    try {
      await fetch("/api/staff/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: action.type,
          defaultReason: reason,
          defaultDurationSeconds: action.hasDuration ? durationSeconds ?? undefined : undefined,
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
          <select
            className="vb-select"
            value={actionKey}
            onChange={(e) => {
              setActionKey(e.target.value);
              setDurationSeconds(null);
            }}
          >
            {ACTION_KINDS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <textarea
            className="vb-textarea"
            placeholder="Default reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          {action.hasDuration && (
            <DurationInput label="Default duration" seconds={durationSeconds} onChange={setDurationSeconds} required />
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
            <input type="checkbox" checked={appealable} onChange={(e) => setAppealable(e.target.checked)} />
            Appealable by default
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={create}
              disabled={saving || !name || !reason || (action.hasDuration && !durationSeconds)}
              className="vb-btn vb-btn-primary"
            >
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
